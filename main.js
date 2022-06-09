const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/lobo-shop');

const express = require('express');
const app = express();

//引入express-session
const session = require("express-session");
//配置
app.use(session({
    secret: 'lobo-shop-session-secret-887910',
    name: 'lobo-shop-session-cookie', //客户端中看到的cookie的名称
    resave: false,  //强制保存session，即使它没发生变化
    saveUninitialized: true,  //强制存储未初始化的session
    cookie: {
        maxAge: 1000 * 60 * 30, //1s * 60 *30
        secure: false //只有https才发送cookie
        //domain: '127.0.0.1:8080'
    },
    rolling: true  //每次请求都会重置cookie的有效时间
}));


const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('public'));
app.use(express.static('public/upload'));

const host = 'http://127.0.0.1:8088';

//解决跨域
app.all('*', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "content-type");
    res.header("Access-Control-Allow-Methods", "DELETE,PUT,POST,GET,OPTION");
    if (req.method.toLowerCase() == 'options') {
        res.send(200);
    } else {
        next();
    }
})


//一级分类
const c1Schema = mongoose.Schema({
    c1names: Array,
    quickEnter: Array
})

const c1Model = mongoose.model('Category_1', c1Schema, 'category_1');

//获取所有分类
app.get('/v1/categorys', async (req, res) => {
    let result = await c1Model.aggregate([
        {
            $lookup: {
                from: "category_2",
                localField: "_id",
                foreignField: "c1_id",
                as: 'children',
                pipeline: [
                    {
                        $lookup: {
                            from: "category_3",
                            localField: "_id",
                            foreignField: "c2_id",
                            as: 'children'
                        }
                    }
                ]
            }
        }
    ])
    res.json(result);
})

app.post('/v1/category_1', async (req, res) => {
    let msg = 'ok';
    if (req.body['_id']) {
        msg = await c1Model.findByIdAndUpdate(req.body._id, req.body);
    } else {
        let c1 = new c1Model(req.body);
        msg = await c1.save();
    }

    res.json(req.body);
})

app.delete('/v1/category_1', async (req, res) => {
    let msg = 'ok';
    msg = await c1Model.findByIdAndDelete(req.body._id);

    res.json(msg);
})

//二级分类
const c2Schema = mongoose.Schema({
    c2name: String,
    c1_id: mongoose.Types.ObjectId
})

const c2Model = mongoose.model('Category_2', c2Schema, 'category_2');

app.post('/v1/category_2', async (req, res) => {
    let msg = 'ok';
    if (req.body['_id']) {
        msg = await c2Model.findByIdAndUpdate(req.body._id, req.body);
    } else {
        let c2 = new c2Model(req.body);
        msg = await c2.save();
    }

    res.json(msg);
})

app.delete('/v1/category_2', async (req, res) => {
    let msg = 'ok';
    msg = await c2Model.findByIdAndDelete(req.body._id);

    res.json(msg);
})

//三级分类
const c3Schema = mongoose.Schema({
    c3name: String,
    c2_id: mongoose.Types.ObjectId
})

const c3Model = mongoose.model('Category_3', c3Schema, 'category_3');

app.post('/v1/category_3', async (req, res) => {
    let msg = 'ok';
    if (req.body['_id']) {
        msg = await c3Model.findByIdAndUpdate(req.body._id, req.body);
    } else {
        let c3 = new c3Model(req.body);
        msg = await c3.save();
    }

    res.json(msg);
})

app.delete('/v1/category_3', async (req, res) => {
    let msg = 'ok';
    msg = await c3Model.findByIdAndDelete(req.body._id);

    res.json(msg);
})

//首页轮播图
//引入图片上传中间件
let multer = require('multer');
//配置
let storage = multer.diskStorage({
    //存储地址
    destination: function (req, file, cb) {
        cb(null, 'public/upload/')
    },
    //文件名字
    filename: function (req, file, cb) {
        //获取文件扩展名
        let fileFormat = (file.originalname).split(".");
        cb(null, Date.now() + "." + fileFormat[fileFormat.length - 1]);
    }
})
//实例化
let upload = multer({ storage: storage })

const homeSwiperSchema = mongoose.Schema({
    picUrl: String
})

const homeSwiperModel = mongoose.model('HomeSwiper', homeSwiperSchema, 'homeSwiper');

app.get('/v1/homeSwiper', async (req, res) => {
    let result = await homeSwiperModel.find({});
    res.json(result);
})

app.post('/v1/homeSwiper', upload.single('file'), async (req, res) => {
    let swiper = new homeSwiperModel({ picUrl: host + '/' + req.file.filename });
    let msg = await swiper.save();
    res.json(msg);
})

app.delete('/v1/homeSwiper', async (req, res) => {
    let msg = await homeSwiperModel.findOneAndDelete({ name: req.body.name });
    res.json(msg);
})


//用户数据库处理
const userSchema = mongoose.Schema({
    phone: String,
    account: String,
    password: String
})

const userModel = mongoose.model('User', userSchema, 'user');

//验证码功能

//引入
const svgCaptcha = require('svg-captcha');

//发送验证码
app.get('/v1/register-verify', (req, res) => {
    let captcha = svgCaptcha.create();
    req.session.captcha = captcha.text;

    res.type('svg');
    res.status(200).send(captcha.data);
})

//验证验证码
app.post('/v1/register-verify', (req, res) => {

    if (req.body.verifyCode == req.session.captcha) {
        userModel.find({ phone: req.phone }, (err, data) => {
            if (data.length != 0) {
                res.status(200).json({
                    code: 201,
                    msg: '手机已注册!'
                })
            } else {
                res.status(200).json({
                    code: 200,
                    msg: '该手机号可注册!'
                })
            }
        });

    } else {
        res.status(200).json({
            code: 201,
            msg: '验证码错误'
        })
    }
})

app.post('/v1/register', (req, res) => {
    userModel.find({ account: req.account }, async (err, data) => {
        if (data.length != 0) {
            res.status(200).json({
                code: 201,
                msg: '该用户名已存在!'
            })
        } else {
            let user = new userModel({
                phone: req.body.phone,
                account: req.body.account,
                password: req.body.password
            });
            await user.save();
            res.status(200).send({
                code: 200,
                msg: '注册成功!'
            })
        }
    });
})


app.listen(8088);
console.log('服务器已启动，正在监听8088端口。')