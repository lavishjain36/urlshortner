const bcrypt = require("bcryptjs");
const JWT = require("jsonwebtoken");
const JWTD = require("jwt-decode");
const secret = "a0990jd90wfhw084wh";
const hashing = async(value)=>{
    try {    
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(value,salt);
        return hash;
    } catch (error) {
        return error;
    }
}
const createJWT = async({firstname,email})=>{
    return await JWT.sign(
        {
            firstname,
            email
        },
        secret,
        {
            expiresIn:"15m"
        }
    )
}
const createJWTLogin = async({firstname,email})=>{
    return await JWT.sign(
        {
            firstname,
            email
        },
        secret,
        {
            expiresIn:"3h"
        }
    )
}
const hashCompare = async(password,hashValue)=>{
    try {
        return await bcrypt.compare(password,hashValue)
    } catch (error) {
        return error;
    }
}
const authenticate = async(token)=>{
    const decode = JWTD(token);
    if(Math.round(new Date() / 1000) <= decode.exp){
        return decode.email;
    }
    else{
        return "";
    }
}
module.exports={hashing,createJWT,authenticate,hashCompare,createJWTLogin};