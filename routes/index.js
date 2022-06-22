var express = require('express');
const { gamesManagement_v1management } = require('googleapis');
var router = express.Router();
const{dbUrl,mongodb,MongoClient}=require("../dbConfig");
const fetch = require("node-fetch");
const { nanoid } = require('nanoid');
router.get('/getall/:email',async(req,res)=>{
  //to get all the details of selected user for dashboard information
  const client = await MongoClient.connect(dbUrl,{ useUnifiedTopology: true });
  let email=req.params.email;
  try {
    const db = client.db("urlshortner");
    let data = await db.collection("url").find({email:email}).sort({time:-1}).toArray();
    res.json(data);
  } catch (error) {
    console.log(error);
  }
  finally{
    client.close();
  }
})

router.get('/getdetails/:url',async(req,res)=>{
  //to get details of any particular selected url
  const client = await MongoClient.connect(dbUrl,{ useUnifiedTopology: true });
  let shorturl = req.params.url;
  try {
    const db = client.db("urlshortner");
    let data = await db.collection("url").findOne({shorturl:shorturl});
    res.json(data);
  } catch (error) {
    console.log(error);
  }
  finally{
    client.close();
  }
})

router.post('/createurl',async(req,res)=>{
  //to create a url body should have {usermail,longurl}
  const parseTitle = (body) => {
    let match = body.match(/<title>([^<]*)<\/title>/) // regular expression to parse contents of the <title> tag
    if (!match || typeof match[1] !== 'string')
      throw new Error('Unable to parse the title tag')
    return match[1]
  }
  let url = req.body.longurl;
  let title = await fetch(url)
  .then(res=>res.text())
  .then(body=>parseTitle(body))
  .then(t=>{return t})
  .catch(e=>{console.log(e)})
  console.log(title);
  const client = await MongoClient.connect(dbUrl,{ useUnifiedTopology: true });
  let data = {
    email:req.body.email,
    longurl:req.body.longurl,
    shorturl: nanoid(6),
    clicks:0,
    title: title,
    time: new Date(),
  }
  try{
    const db = client.db("urlshortner");
    let url = await db.collection("url").insertOne(data);
    res.json(data);
  }
  catch(error){
    console.log(error);
    res.sendStatus(403);
  }
  finally{
    client.close();
  }
        

})

router.delete('/delete/:url',async(req,res)=>{
  //to delete the seleceted url
  const client = await MongoClient.connect(dbUrl,{useUnifiedTopology:true});
  try {
      let db = client.db("urlshortner");
      let data = await db.collection("url").deleteOne({shorturl:req.params.url});
      res.json({
        message:"Deleted Successfully"
      })
  } catch (error) {
    console.log(error);
  }
  finally{
    client.close();
  }
})

router.get('/:url',async function(req, res) {
  //to redirect it to the actual link
  const client = await MongoClient.connect(dbUrl,{ useUnifiedTopology: true });
  let shorturl = req.params.url;
  try {
    console.log(shorturl);
    const db = client.db("urlshortner");
    let data = await db.collection("url").findOneAndUpdate({shorturl:shorturl},{$inc:{clicks:1}});
    if(data.value){
      res.redirect(data.value.longurl);
    }
    else{
      res.json({
        message:"Url not found"
      })
    }
  } catch (error) {
    console.log(error);
  }
  finally{
    client.close();
  }
});

module.exports = router;
