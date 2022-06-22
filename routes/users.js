var express = require('express');
const nodemailer = require("nodemailer");
const {google} = require("googleapis");
const{dbUrl,mongodb,MongoClient}=require("../dbConfig");
var router = express.Router();
const{hashing, createJWT,authenticate,hashCompare,createJWTLogin}=require("../library/auth");
const{sender,pwd,CLIENT_ID,CLIENT_SECRET,REDIRECT_URI,REFRESH_TOKEN}=require("../library/config");
const path = require("path");
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID,CLIENT_SECRET,REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN});
/* GET users listing. */
router.get('/getdetails/:email', async(req, res)=> {
  const client = await MongoClient.connect(dbUrl,{ useUnifiedTopology: true });
  try{
    const db = client.db("urlshortner");
    let user = await db.collection("users").findOne({email:req.params.email})
    if(user){
      res.send({
        firstname:user.firstname,
        lastname:user.lastname,
        role:user.role
      })
    }
    else{
      console.log("error");
    }
  }
  catch(error){
    console.log(error);
  }
  finally{
    client.close()
  }
});

router.post("/register",async(req,res)=>{
  const client = await MongoClient.connect(dbUrl);
  try {
    const db = client.db("urlshortner");
    let user = await db.collection("users").findOne({email:req.body.email});
    if(user){
      res.json({//if user exist
        message:"User already exists"
      })
    }
    else{
      const hash = await hashing(req.body.password);//hash the pwd
      req.body.password = hash;
      const document = await db.collection("users").insertOne(req.body);
      const token = await createJWT({//token generation
        firstname:req.body.firstname,
        email:req.body.email
      })
      const accessToken = await oAuth2Client.getAccessToken();
      const transport = await nodemailer.createTransport({//create transport
        service:"gmail",//service provider
        auth:{
          type:"OAuth2",
          user:"nagarajansai2727@gmail.com",
          clientId:CLIENT_ID,
          clientSecret:CLIENT_SECRET,
          refreshToken:REFRESH_TOKEN,
          accessToken:accessToken
      }
      })
      const sendConfirmationEmail = await transport.sendMail({//sending mail with activation link
        from:"URL Shortner <nagarajansai2727@gmail.com>",
        to:req.body.email,
        subject:"Account Activation",
        html:`<h1>Email Confirmation</h1>
        <h2>Hello ${req.body.firstname}</h2>
        <p>You are one step away to shorten your lengthy url. Please confirm your email by clicking on the following link</p>
        <a href=https://urlshortnerbe.herokuapp.com/users/confirm/${token}> Click here</a>
        <p>The link expires 15 minutes from now</p>
        </div>`
      })
      res.status(200).json({
        message:"Acount created",
        instruction:"Activation email sent to your email"
      })
    }
  } catch (error) {
    console.log(error);
    res.json({
      message:"Error Occured at Server end"
    });
  }
  finally{
    client.close();
  }
})


router.get("/confirm/:token",async(req,res)=>{//account activation from the link from  mail
  const client = await MongoClient.connect(dbUrl);
  const token = req.params.token;
  const mail = await authenticate(token);//authenticating the token and decoding the email address
  try {
    const db = client.db("urlshortner");
    let user = await db.collection("users").findOne({email:mail});
    if(user){
      let doc = await db.collection("users").updateOne({email:mail},{$set:{status:"Active"}})//change the status
      res.sendFile(path.join(__dirname, '../library/confirm.html'))//rendering a html file to confirm activation
    }
    else{
      resizeBy.json({
        message:"Link Invalid"
      })
    }
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
})


router.post("/login",async(req,res)=>{
  const client = await MongoClient.connect(dbUrl);
  const {email,password}=req.body;
  try {
    const db = client.db("urlshortner");
    var user =await db.collection("users").findOne({email:email});
    if(user){//check for existing user
      if(user.status=="Active"){//check for the status
        const compare = await hashCompare(password,user.password);
        if(compare){
          //generate token
            const token = await createJWTLogin({
              firstname:user.firstname,
              email:user.email
            })
            let details = await db.collection("users").updateOne({email:user.email},{$set:{token:token}})
            res.status(200).json({
              token,
              firstname:user.firstname,
              message:"Login Successfull"
            })
        }else{
            res.json({//if password is wrong
            message:"Invalid Password"
          })
        }
      }
      else{
        const token = await createJWT({//token generation
          firstname:user.firstname,
          email:user.email
        })
        const accessToken = await oAuth2Client.getAccessToken();
        const transport = await nodemailer.createTransport({//create transport
        service:"gmail",//service provider
        auth:{
          type:"OAuth2",
          user:"nagarajansai2727@gmail.com",
          clientId:CLIENT_ID,
          clientSecret:CLIENT_SECRET,
          refreshToken:REFRESH_TOKEN,
          accessToken:accessToken
      }
      })
      const sendConfirmationEmail = await transport.sendMail({//sending mail with activation link
        from:"URL Shortner <nagarajansai2727@gmail.com>",
        to:user.email,
        subject:"Account Activation",
        html:`<h1>Email Confirmation</h1>
        <h2>Hello ${user.firstname}</h2>
        <p>You are one step away to shorten your lengthy url. Please confirm your email by clicking on the following link</p>
        <a href=https://urlshortnerbe.herokuapp.com/users/confirm/${token}> Click here</a>
        <p>The link expires 15 minutes from now</p>
        </div>`
      })
        res.json({//if account activation is pending
          message:"Account activation required",
          instruction:"Check your mail inbox for activation link"
        })
      }
    }
    else{
        res.json({//if user does not exist
          message:"No User Available"
        })
    }
  } catch (error) {
      console.log(error);
      res.json({
        message:"Error Occured at Server end"
      });
  }
  finally{
    client.close()//closing the connection
  }
})


router.post('/reset-password',async(req,res)=>{
  //verify the email exist and create a JWT and send the pwd reset link to that persons email
  var email = req.body.email;
  const client = await MongoClient.connect(dbUrl);
  try{
    const db = client.db("urlshortner");
    let user = await db.collection("users").findOne({email:req.body.email});
    if(user){
      const token = await createJWT({//token generation
        firstname:user.firstname,
        email:user.email
      })
      let userUpdate=await db.collection("users").updateOne({email:user.email},{$set:{token:token}});
        const accessToken = await oAuth2Client.getAccessToken();
        const transport = await nodemailer.createTransport({//create transport
        service:"gmail",//service provider
        auth:{
          type:"OAuth2",
          user:"nagarajansai2727@gmail.com",
          clientId:CLIENT_ID,
          clientSecret:CLIENT_SECRET,
          refreshToken:REFRESH_TOKEN,
          accessToken:accessToken
      }
      })
      const sendResetLink = await transport.sendMail({//sending mail with pwd reset link
        from:"URL Shortner <nagarajansai2727@gmail.com>",
        to:user.email,
        subject:"Password Reset Link",
        html:`<h2>Hello ${user.firstname}</h2>
        <p>We've recieved a request to reset the password for your account associated with your email.
        You can reset your password by clicking the link below</p>
        <a href=https://urlshortneer.herokuapp.com/user/update-password/${token}> Reset Password</a>
        <p><b>Note:</b>The link expires 15 minutes from now</p>
        </div>`
      })
      res.status(200).json({
        message:"Password Reset link sent to your mail"
      })
    }
    else{
      res.json({
        message:"Invalid User"
      })
    }
  }
  catch(error){
    res.json({
      message:"Error Occured at Server end"
    });
  }
  finally{
    client.close();
  }
})

router.post('/update-password',async(req,res)=>{
  //get the new password and change the password in the db. The email should be decoded from the jwt sent from front end
  const client = await MongoClient.connect(dbUrl);
  const {token,password} = req.body;
  const mail = await authenticate(token);//authenticating the token and decoding the email address
  if(mail){
    try {
      const db = client.db("urlshortner");
      let user = await db.collection("users").findOne({email:mail});
      if(user && user.token===token){
          const hash = await hashing(password);
          let doc = await db.collection("users").updateOne({email:mail},{$set:{password:hash,token:""}})//change the pwd in db and delete the token
          res.json({
            message:"Password Updated Successfully"
          })
        }
      else{
        res.json({
          message:"Link Invalid"
        })
      }
    } catch (error) {
      console.log(error);
      res.sendStatus(500);
    }
  }
  else{
    res.json({
      message:"Link Expired"
    })
  }
})

router.post('/logout',async(req,res)=>{
  var email = req.body.email;
  const client = await MongoClient.connect(dbUrl);
  try {
    const db = client.db("urlshortner");
    let user = await db.collection("users").updateOne({email:email},{$set:{token:""}});
    res.json({
      message:"Logout Successfull"
    })
  } catch (error) {
    console.log(error);
  }
  finally{
    client.close();
  }
})

router.post('/authenticate',async(req,res)=>{
    const mail = await authenticate(req.body.token);
    if(mail)
      res.json({
        auth:true
      })
    else
      res.json({
        auth:false
      })
})
module.exports = router;