const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/lobo-shop');

const express = require('express');
const app = express();

const fs = require('fs');

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
app.use(express.static('public/homeswiper'));
app.use(express.static('public/spuswiper'));

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
let storage_homeswiper = multer.diskStorage({
    //存储地址
    destination: function (req, file, cb) {
        cb(null, 'public/homeswiper/')
    },
    //文件名字
    filename: function (req, file, cb) {
        //获取文件扩展名
        let fileFormat = (file.originalname).split(".");
        cb(null, Date.now() + "." + fileFormat[fileFormat.length - 1]);
    }
})
//实例化
let upload_homeswiper = multer({ storage: storage_homeswiper })

const homeswiperSchema = mongoose.Schema({
    name: String,
    url: String
})

const homeswiperModel = mongoose.model('Homeswiper', homeswiperSchema, 'homeswiper');

app.get('/v1/homeSwiper', async (req, res) => {
    let result = await homeswiperModel.find({});
    res.json(result);
})

app.post('/v1/homeSwiper', upload_homeswiper.single('file'), async (req, res) => {
    let swiper = new homeswiperModel({
        name: req.file.filename,
        url: host + '/' + req.file.filename
    });
    let msg = await swiper.save();
    res.json(msg);
})

app.delete('/v1/homeSwiper', async (req, res) => {
    let msg = await homeswiperModel.findOneAndDelete({ name: req.body.name });
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

//登陆功能

//引入token包
const jwt = require('jsonwebtoken');
const e = require('express');

app.post('/v1/login', (req, res) => {
    userModel.find({ account: req.body.account }, (err, data) => {
        if (data.length != 0) {
            if (data[0].password === req.body.password) {
                let token = jwt.sign({ account: req.body.account }, 'lobo-shop', {
                    //过期时间60s
                    expiresIn: 300
                });

                res.send({
                    code: 200,
                    msg: '登陆成功',
                    token
                });
            } else {
                res.send({
                    code: 201,
                    msg: '账号或密码错误'
                });
            }
        } else {
            res.send({
                code: 201,
                msg: '账号或密码错误'
            });
        }
    })
})

//获取用户信息
app.get('/v1/userInfo', (req, res) => {
    jwt.verify(req.headers.token, 'lobo-shop', (err, decode) => {
        if (err) {
            res.send({
                code: 201,
                msg: '登陆已过期，请重新登陆'
            });
        } else {
            userModel.aggregate([
                {
                    $match: { "account": decode.account }
                },
                {
                    $project: { "account": 1, "_id": 0 }
                }
            ], (err, data) => {
                if (err) {
                    res.send({
                        code: 201,
                        msg: err.message
                    });
                } else {
                    res.send({
                        code: 200,
                        msg: '获取个人信息成功',
                        data: data[0]
                    });
                }
            })
        }
    });
})

//SKU数据
const skuSchema = mongoose.Schema({
    description: String,
    c1_id: String,
    c2_id: String,
    c3_id: String,
    attrList: Array
})

const skuModel = mongoose.model('Sku', skuSchema, 'sku');

app.get('/v1/sku', async (req, res) => {
    skuModel.aggregate([
        {
            $lookup: {
                from: 'spu',
                localField: '_id',
                foreignField: 'sku_id',
                as: 'spuList'
            }
        }
    ], (err, data) => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: '查询sku失败'
            })
        } else {
            res.status(200).send({
                code: 200,
                msg: '查询sku成功',
                data
            })
        }
    })
})

app.post('/v1/sku', async (req, res) => {
    if (req.body._id) {
        //更新
        skuModel.findByIdAndUpdate({ '_id': req.body._id }, req.body, (err, result) => {
            if (err) {
                res.status(200).send({
                    code: 201,
                    msg: '更新sku失败'
                })
            } else {
                res.status(200).send({
                    code: 200,
                    msg: '更新sku成功'
                })
            }
        });
    } else {
        //新增
        let sku = new skuModel({
            ...req.body
        });

        await sku.save();

        res.status(200).send({
            code: 200,
            msg: '添加sku成功'
        })
    }
})

app.delete('/v1/sku', async (req, res) => {
    skuModel.findByIdAndDelete({ '_id': req.body._id }, (err, result) => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: '删除sku失败'
            })
        } else {
            res.status(200).send({
                code: 200,
                msg: '删除sku成功'
            })
        }
    })
})

//SPU图片

//配置
let storage_spuswiper = multer.diskStorage({
    //存储地址
    destination: function (req, file, cb) {
        cb(null, 'public/spuswiper/')
    },
    //文件名字
    filename: function (req, file, cb) {
        //获取文件扩展名
        let fileFormat = (file.originalname).split(".");
        cb(null, Date.now() + "." + fileFormat[fileFormat.length - 1]);
    }
})
//实例化
let upload_spuswiper = multer({ storage: storage_spuswiper })

const spuswiperSchema = mongoose.Schema({
    name: String,
    url: String
})

const spuswiperModel = mongoose.model('Spuswiper', spuswiperSchema, 'spuswiper');

//SPU数据
const spuSchema = mongoose.Schema({
    sku_id: mongoose.Types.ObjectId,
    longDescription: String,
    shortDescription: String,
    weight: Number,
    swipers: Array,
    attrList: Array
})

const spuModel = mongoose.model('Spu', spuSchema, 'spu');


app.post('/v1/spu', async (req, res) => {
    if (req.body._id) {
        //更新
        spuModel.findByIdAndUpdate({ '_id': req.body._id }, req.body, (err, result) => {
            if (err) {
                res.status(200).send({
                    code: 201,
                    msg: '更新spu失败'
                })
            } else {
                res.status(200).send({
                    code: 200,
                    msg: '更新spu成功'
                })
            }
        })
    } else {
        //新增
        let spu = new spuModel({
            ...req.body
        });

        await spu.save();

        res.status(200).send({
            code: 200,
            msg: '添加spu成功'
        })
    }
})

app.delete('/v1/spu', async (req, res) => {
    spuModel.findByIdAndDelete({ '_id': req.body._id }, (err, result) => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: '删除spu失败'
            })
        } else {
            res.status(200).send({
                code: 200,
                msg: '删除spu成功'
            })
        }
    })
})

//SPU图片上传
app.post('/v1/spuSwiper', upload_spuswiper.single('file'), async (req, res) => {
    console.log(req.file.filename);
    let swiper = new spuswiperModel({
        name: req.file.filename,
        url: host + '/' + req.file.filename
    });
    let msg = await swiper.save();
    res.json(msg);
})

app.delete('/v1/spuSwiper', async (req, res) => {
    fs.unlink('public/spuswiper/' + req.body.filename, err => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: '删除spu图片失败'
            })
        } else {
            res.status(200).send({
                code: 200,
                msg: '删除spu图片成功'
            })
        }
    });
})

//搜索功能

app.listen(8088);
console.log('服务器已启动，正在监听8088端口。')