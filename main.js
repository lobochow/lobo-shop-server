const mongoose = require('mongoose');
mongoose.connect('mongodb://admin:qweasd887910@45.45.177.71:27017/lobo-shop');
//mongoose.connect('mongodb://localhost:27017/lobo-shop');

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
app.use(express.static('public/front'));
app.use(express.static('public/console'));
app.use(express.static('public/homeswiper'));
app.use(express.static('public/spuswiper'));

const host = 'http://45.45.177.71:8088';
//const host = 'http://127.0.0.1:8088';

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
    let aggregateOption = [];

    aggregateOption.push({
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
    })

    if (req.query.currentPage && req.query.pageSize) {
        aggregateOption.push({
            $skip: (req.query.currentPage - 1) * req.query.pageSize
        });

        aggregateOption.push({
            $limit: Number(req.query.pageSize)
        });
    }

    let result = await c1Model.aggregate(aggregateOption);
    c1Model.count({}, (err, count) => {
        res.json({
            categorys: result,
            count
        });
    });

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
    password: String,
    userInfo: Object
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
        userModel.find({ phone: req.body.phone }, (err, data) => {
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

//注册账号
app.post('/v1/register', (req, res) => {
    userModel.find({ account: req.body.account }, async (err, data) => {
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
const { Axios, default: axios } = require('axios');

//登陆
app.post('/v1/login', (req, res) => {
    userModel.find({ account: req.body.account }, (err, data) => {
        //找不到是data为undefined
        if (data && data.length != 0) {
            if (data[0].password === req.body.password) {
                let token = jwt.sign({ account: req.body.account, user_id: data[0]._id }, 'lobo-shop', {
                    //过期时间600s
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
                    $project: { "account": 1, "userInfo": 1, "_id": 1 }
                }
            ], (err, data) => {
                if (err) {
                    res.send({
                        code: 202,
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
    c1_id: mongoose.Types.ObjectId,
    c2_id: mongoose.Types.ObjectId,
    c3_id: mongoose.Types.ObjectId,
    attrList: Array
})

const skuModel = mongoose.model('Sku', skuSchema, 'sku');

app.get('/v1/sku', async (req, res) => {
    let aggregateOption = [];
    let result = {};

    if (req.query.sku_id) {
        aggregateOption.push({
            $match: {
                '_id': mongoose.Types.ObjectId(req.query.sku_id)
            }
        });
    }

    //关联spu
    aggregateOption.push({
        $lookup: {
            from: 'spu',
            localField: '_id',
            foreignField: 'sku_id',
            as: 'spuList'
        }
    });

    if (req.query.pageSize && req.query.currentPage) {
        aggregateOption.push({
            $skip: (req.query.currentPage - 1) * req.query.pageSize
        });

        aggregateOption.push({
            $limit: Number(req.query.pageSize)
        });

        let count = await skuModel.count();
        result.count = count;
    }



    skuModel.aggregate(aggregateOption, (err, data) => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: err.message
            })
        } else {
            if (result.count) {
                result.skuList = data;
            } else {
                result = data;
            }
            res.status(200).send({
                code: 200,
                msg: '查询sku成功',
                data: result
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
    price: Number,
    weight: Number,
    swipers: Array,
    attrList: Array
})

const spuModel = mongoose.model('Spu', spuSchema, 'spu');

app.get('/v1/spu', async (req, res) => {
    let aggregateOption = [];
    if (req.query._id) {
        aggregateOption.push({
            $match: {
                '_id': mongoose.Types.ObjectId(req.query._id)
            }
        });
    }

    spuModel.aggregate(aggregateOption, (err, data) => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: '查询spu失败'
            })
        } else {
            res.status(200).send({
                code: 200,
                msg: '查询spu成功',
                data
            })
        }
    })
})


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
    let swiper = new spuswiperModel({
        name: req.file.filename,
        url: host + '/' + req.file.filename
    });
    let msg = await swiper.save();
    res.json(msg);
})

app.delete('/v1/spuSwiper', async (req, res) => {
    fs.unlink('public/spuswiper/' + req.body.name, err => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: err
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
app.get('/v1/search', async (req, res) => {
    let query = req.query;

    let keyword = query.keyword;
    delete query.keyword;

    let pageSize = req.query.pageSize;
    let currentPage = req.query.currentPage;
    delete query.pageSize;
    delete query.currentPage;

    let attrList = Object.keys(query).map(key => ({
        'attrName': key,
        'attrValue': query[key]
    }));

    let keywordReg = new RegExp(keyword);

    let aggregateOptions = [
        //查询c1名称
        {
            $lookup:
            {
                from: "category_1",
                localField: "c1_id",
                foreignField: "_id",
                as: "c1"
            }
        },
        //查询c2名称
        {
            $lookup:
            {
                from: "category_2",
                localField: "c2_id",
                foreignField: "_id",
                as: "c2"
            }
        },
        //查询c3名称
        {
            $lookup:
            {
                from: "category_3",
                localField: "c3_id",
                foreignField: "_id",
                as: "c3"
            }
        },
        //匹配sku描述、c1name、c2name、c3name是否有关键词
        {
            $match: {
                $or: [
                    { description: keywordReg },
                    { 'c1.c1names': { "$in": [keywordReg] } },
                    { "c2.c2name": keywordReg },
                    { "c3.c3name": keywordReg }
                ]
            }
        },
        //查询相关spu
        {
            $lookup:
            {
                from: "spu",
                localField: "_id",
                foreignField: "sku_id",
                as: "spus"
            }
        },
        //压平spus数组
        {
            $unwind: '$spus'
        },
        //用spu信息作为根
        {
            $replaceRoot: {
                newRoot: "$spus"
            }
        },
        //搜索sku
        {
            $lookup:
            {
                from: "sku",
                localField: "sku_id",
                foreignField: "_id",
                as: "skuInfo"
            }
        },
        //压平skuInfo
        {
            $unwind: '$skuInfo'
        }
    ];

    if (attrList.length != 0) {
        aggregateOptions.push(
            //属性搜索
            {
                $match: {
                    'attrList': {
                        $all: attrList
                    }
                }
            })
    }


    let count = -1;
    if (pageSize && currentPage) {
        count = await skuModel.aggregate([...aggregateOptions, { $count: 'count' }]);

        aggregateOptions.push({
            $skip: (currentPage - 1) * pageSize
        });

        aggregateOptions.push({
            $limit: Number(pageSize)
        });
    }

    await skuModel.aggregate(aggregateOptions, (err, data) => {
        if (err) {
            res.status(200).send({
                code: 201,
                msg: '查询失败'
            })
        } else {
            let result = {};
            if (count !== -1) {
                result.count = count;
                result.spuList = data;
            } else {
                result = data;
            }
            res.status(200).send({
                code: 200,
                msg: '查询成功',
                data: result
            })
        }
    });


})

//购物车
const cartSchema = mongoose.Schema({
    user_id: mongoose.Types.ObjectId,
    goodsList: {
        type: [{
            count: Number,
            spu_id: mongoose.Types.ObjectId
        }]
    }
})

const cartModel = mongoose.model('Cart', cartSchema, 'cart');

app.get('/v1/cart', (req, res) => {
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
                    $lookup: {
                        from: "cart",
                        localField: "_id",
                        foreignField: "user_id",
                        as: "cartInfo"
                    }
                },
                {
                    $project: { "cartInfo": 1 }
                },
                {
                    $unwind: "$cartInfo"
                },
                {
                    $unwind: "$cartInfo.goodsList"
                },
                {
                    $replaceRoot: {
                        newRoot: "$cartInfo.goodsList"
                    }
                },
                {
                    $lookup: {
                        from: "spu",
                        localField: "spu_id",
                        foreignField: "_id",
                        as: "spuInfo"
                    }
                },
                {
                    $unwind: "$spuInfo"
                },
                {
                    $project: {
                        "count": 1,
                        "spuInfo": 1,
                        "_id": 0
                    }
                },
                {
                    $lookup: {
                        from: "sku",
                        localField: "spuInfo.sku_id",
                        foreignField: "_id",
                        as: "skuInfo"
                    }
                },
                {
                    $unwind: "$skuInfo"
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
                        msg: '获取购物车信息成功',
                        data
                    });
                }
            })
        }
    });
})

app.post('/v1/cart', (req, res) => {
    jwt.verify(req.headers.token, 'lobo-shop', async (err, decode) => {
        if (err) {
            res.send({
                code: 201,
                msg: '登陆已过期，请重新登陆'
            });
        } else {
            cartModel.findOneAndUpdate({ user_id: mongoose.Types.ObjectId(decode.user_id) }, req.body, { 'upsert': true }, (err, result) => {
                if (err) {
                    res.send({
                        code: 201,
                        msg: err
                    })
                } else {
                    res.send({
                        code: 200,
                        msg: '更新购物车成功'
                    })
                }
            });

        }
    });
})

//订单
const billSchema = mongoose.Schema({
    user_id: mongoose.Types.ObjectId,
    finishTime: String,
    spuList: [{
        buyNum: Number,
        spu_id: mongoose.Types.ObjectId
    }]
})

const billModel = mongoose.model('Bill', billSchema, 'bill');

app.get('/v1/bill', (req, res) => {
    jwt.verify(req.headers.token, 'lobo-shop', async (err, decode) => {
        if (err) {
            res.send({
                code: 201,
                msg: '登陆已过期，请重新登陆'
            });
        } else {
            let aggregateOption = [
                {
                    $match: {
                        "user_id": mongoose.Types.ObjectId(decode.user_id)
                    }
                },
                {
                    $lookup: {
                        from: "spu",
                        localField: "spuList.spu_id",
                        foreignField: "_id",
                        as: "spuInfo",
                        pipeline: [
                            {
                                $lookup: {
                                    from: "sku",
                                    localField: "sku_id",
                                    foreignField: "_id",
                                    as: 'skuInfo'
                                }
                            },
                            {
                                $unwind: '$skuInfo'
                            }
                        ]
                    }
                }
            ];

            let count = -1;

            //分页器
            if (req.query.pageSize && req.query.currentPage) {
                count = await billModel.aggregate([...aggregateOption, { $count: 'count' }]);

                aggregateOption.push({
                    $skip: (req.query.currentPage - 1) * req.query.pageSize
                });

                aggregateOption.push({
                    $limit: Number(req.query.pageSize)
                });
            }

            billModel.aggregate(aggregateOption, (err, data) => {
                if (err) {
                    res.send({
                        code: 201,
                        msg: err.message
                    });
                } else {
                    let result = {};
                    if (count !== -1) {
                        result.count = count[0]?.count ?? 0;
                        result.billList = data;
                    } else {
                        result = data;
                    }
                    res.send({
                        code: 200,
                        msg: '获取订单信息成功',
                        data: result
                    });
                }
            })
        }
    });
})

app.post('/v1/bill', (req, res) => {
    jwt.verify(req.headers.token, 'lobo-shop', async (err, decode) => {
        if (err) {
            res.send({
                code: 201,
                msg: '登陆已过期，请重新登陆'
            });
        } else {
            let bill = new billModel({ ...req.body });
            bill.save();
        }
    });
})

//微信小程序接口
//注册兼登陆

//非云托管版本
// app.post('/mircoApp/login', async (req, res) => {
    
//     let { code: js_code, userInfo } = req.body;
//     let appid = 'wxf79b4bc85c8fca4b';
//     let secret = '60cff4738e73980e84ca69e49145f876';

//     console.log(js_code);
//     console.log(userInfo);

//     let result = await axios({
//         url: `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${js_code}&grant_type=authorization_code`,
//         method: 'GET'
//     });

    

//     let { session_key, openid } = result.data;
//     console.log('兑换openid', openid);

//     //注册用户
//     userModel.find({ account: openid }, async (err, data) => {
//         let token = '';
//         if (data.length === 0) {
//             let user = new userModel({
//                 account: openid,
//                 userInfo
//             });
//             let data = await user.save();
//             token = jwt.sign({ account: openid, user_id: data._id }, 'lobo-shop', {
//                 //过期时间600s
//                 expiresIn: 60
//             });
//         } else {
//             token = jwt.sign({ account: openid, user_id: data[0]._id }, 'lobo-shop', {
//                 //过期时间600s
//                 expiresIn: 60
//             });
//         }

//         res.status(200).json(token);
//     });
// })

//云托管版
app.post('/mircoApp/login', async (req, res) => {

    let openid = req.headers['x-wx-openid'];
    console.log(openid)

    //注册用户
    userModel.find({ account: openid }, async (err, data) => {
        let token = '';
        if (data.length === 0) {
            let user = new userModel({
                account: openid,
                userInfo
            });
            let data = await user.save();
            token = jwt.sign({ account: openid, user_id: data._id }, 'lobo-shop', {
                //过期时间600s
                expiresIn: 600
            });
            console.log('注册');
        } else {
            token = jwt.sign({ account: openid, user_id: data[0]._id }, 'lobo-shop', {
                //过期时间600s
                expiresIn: 600
            });
            console.log('登陆');
        }

        res.status(200).json(token);
    });
})

app.listen(8088);
console.log('服务器已启动，正在监听8088端口。')