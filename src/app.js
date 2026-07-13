import express from  'express'

export const createApp = ()=>{

 const app = express() ;


   const allowedOrigins = [
        "http://localhost:3000",
        // "https://www.wineandchampagnegifts.com/",
        // "https://wineandchampagnegifts.com/",
        // "https://admin.wineandchampagnegifts.com/",
        // "https://www.weddingwinegifts.com",
        // "https://weddingwinegifts.com",
        process.env.FRONTEND_URL,
    ].filter(Boolean);


    app.use('/health', (_req,res)=>{
       res.json({sucess:true, message:"welcome to my websites....!"} )
    })


    return app ;
}