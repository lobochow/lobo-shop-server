const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/lobo-shop');

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//解决跨域
app.all(path='*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:8080");
    res.header("Access-Control-Allow-Headers", "content-type");
    res.header("Access-Control-Allow-Methods", "DELETE,PUT,POST,GET,OPTION");
    if(req.method.toLowerCase() == 'options'){
        res.send(200);
    }else{
        next();
    }
})


//添加分类1
const c1Schema = mongoose.Schema({
    pid: String,
    name: String
})

const c1Model = mongoose.model('Category_1', c1Schema, 'category_1');

app.get('/v1/category_1', (req, res) => {
    res.send('响应');
})

app.post('/v1/category_1', (req, res) => {
    console.log(req.body.name);
    let c1 = new c1Model({
        pid: '0',
        name: req.body.name
    });

    c1.save();

    res.json({
        code: 200,
        msg: 'ok'
    });
})


app.listen(8088);
console.log('服务器已启动，正在监听8088端口。')