var express = require('express');
var router = express.Router();
var config = require('./../../config');
var User = require('./../../models/users');
var CarBooking = require('./../../models/car_booking');
var path = require('path');
var async = require("async");
var ObjectId = require('mongoose').Types.ObjectId;
var bcrypt = require('bcrypt');
var auth = require('./../../middlewares/auth');
var moment = require('moment');
var SALT_WORK_FACTOR = config.SALT_WORK_FACTOR;
var _ = require('underscore');
var jwt = require('jsonwebtoken');
var mailHelper = require('./../../helper/mail');

/**
 * @api {post} /company/users/report_list create report list for cars
 * @apiName Listing of users report
 * @apiDescription This is for listing user report
 * @apiGroup Admin - Users
 * @apiVersion 0.0.0
 * 
 * @apiParam {String} start pagination start page no
 * @apiParam {String} end pagination length no of page length
 * @apiParam {String} company_id companyId 
 * 
 * @apiHeader {String}  Content-Type application/json   
 * @apiHeader {String}  x-access-token Admin unique access-key  
 * 
 * @apiSuccess (Success 200) {String} message Success message.
 * @apiError (Error 4xx) {String} message Validation or error message.
 */
router.post('/report_list', async (req, res, next) => {
    console.log('here');
    var schema = {
        'start': {
            notEmpty: true,
            errorMessage: "start is required"
        },
        'length': {
            notEmpty: true,
            errorMessage: "length is required"
        }
    };
    req.checkBody(schema);
    var errors = req.validationErrors();
    if (!errors) {
        var defaultQuery = [
            {
                $match: {
                    "isDeleted": false
                },
            },
            {
                $lookup: {
                    from: 'cars',
                    localField: 'carId',
                    foreignField: '_id',
                    as: 'car_details'
                }
            },
            {
                $unwind: {
                    "path": "$car_details"
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user_details'
                }
            },
            {
                $unwind: {
                    "path": "$user_details"
                }
            },
            {
                $lookup: {
                    from: 'car_company',
                    localField: 'car_details.car_rental_company_id',
                    foreignField: '_id',
                    as: 'car_compnay'
                }
            },
            {
                $unwind: '$car_compnay'
            },
            {
                $lookup: {
                    from: 'car_model',
                    localField: 'car_details.car_model_id',
                    foreignField: '_id',
                    as: 'car_model'
                }
            },
            {
                $unwind: '$car_model'
            },
            {
                $lookup: {
                    from: 'car_brand',
                    localField: 'car_details.car_brand_id',
                    foreignField: '_id',
                    as: 'car_brand'
                }
            },
            {
                $unwind: '$car_brand'
            },
            {
                $match: {
                    "car_details.car_rental_company_id" : new ObjectId(req.body.company_id)
                }
            }];
            if (req.body.date) {
                var date = moment(req.body.date).utc();
                defaultQuery.push({
                    $match: {
                        'from_time': { $lte: new Date(date) },
                        'to_time': { $gte: new Date(date) }
                    },
                })
            }
            defaultQuery.push({
                $group: {
                    "_id": "$carId",
                    "no_of_rented": { "$sum": 1 },
                    "company_name": { $first: "$car_compnay.name" },
                    "car_modal": { $first: "$car_model.model_name" },
                    "car_brand": { $first: "$car_brand.brand_name" },
                    "isDeleted": { $first: "$car_details.isDeleted" },
                    "totalrent": { "$sum": "$booking_rent" },
                    "first_name": { $first: "$user_details.first_name" },
                    "last_name": { $first: "$user_details.last_name" },
                }
            },
            {
                $project: {
                    _id: 1,
                    no_of_rented: 1,
                    company_name: 1,
                    car_modal: 1,
                    car_brand: 1,
                    isDeleted: 1,
                    totalrent: 1,
                    first_name: 1,
                    last_name:1
                }
            });

        var totalrecords = await CarBooking.aggregate(defaultQuery);
        if (typeof req.body.search !== 'undefined' && req.body.search !== null && Object.keys(req.body.search).length > 0 && req.body.search.value !== '') {
            if (req.body.search.value != undefined) {
                var regex = new RegExp(req.body.search.value);
                var match = { $or: [] };
                req.body['columns'].forEach(function (obj) {
                    if (obj.name) {
                        var json = {};
                        if (obj.isNumber) {
                            json[obj.name] = parseInt(req.body.search.value)
                        } else {
                            json[obj.name] = {
                                "$regex": regex,
                                "$options": "i"
                            }
                        }
                        match['$or'].push(json)
                    }
                });
            }
            console.log('re.body.search==>', req.body.search.value);
            var searchQuery = {
                $match: match
            }
            defaultQuery.push(searchQuery);
            console.log("==>", JSON.stringify(defaultQuery));
        }
        if (typeof req.body.order !== 'undefined' && req.body.order.length > 0) {
            var colIndex = req.body.order[0].column;
            var colname = req.body.columns[colIndex].name;
            colname = '$' + colname;
            var order = req.body.order[0].dir;
            if (order == "asc") {
                defaultQuery = defaultQuery.concat({
                    $project: {
                        "records": "$$ROOT",
                        "sort_index": { "$toLower": [colname] }
                    }
                },
                    {
                        $sort: { "sort_index": 1 }
                    },
                    {
                        $replaceRoot: { newRoot: "$records" }
                    })
            } else {
                defaultQuery = defaultQuery.concat({
                    $project: {
                        "records": "$$ROOT",
                        "sort_index": { "$toLower": [colname] }
                    }
                },
                    {
                        $sort: {
                            "sort_index": -1
                        }
                    },
                    {
                        $replaceRoot: { newRoot: "$records" }
                    })
            }
        }
        if (req.body.start) {
            defaultQuery.push({
                "$skip": req.body.start
            })
        }
        if (req.body.length) {
            defaultQuery.push({
                "$limit": req.body.length
            })
        }
        console.log('defaultQuery===>', JSON.stringify(defaultQuery));
        CarBooking.aggregate(defaultQuery, function (err, data) {
            console.log('data===>', data);
            if (err) {
                return next(err);
            } else {
                res.status(config.OK_STATUS).json({
                    message: "Success",
                    result: { recordsTotal: totalrecords.length, data: data }
                });
            }
        })
    } else {
        res.status(config.BAD_REQUEST).json({
            message: "Validation Error",
            error: errors
        });
    }
});

module.exports = router;