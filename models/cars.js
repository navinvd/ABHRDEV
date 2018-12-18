//Require Mongoose
var mongoose = require('mongoose');

//Define a schema
var Schema = mongoose.Schema;
var CarSchema = new Schema({
    car_rental_company_id: mongoose.Schema.Types.ObjectId,
    car_gallery: [ String],
    car_model_id : mongoose.Schema.Types.ObjectId,
    car_brand_id : mongoose.Schema.Types.ObjectId,
    car_color: {
        type: String,
    },
    is_navigation: {
        type: Boolean,
        default: true
    },
    rent_price:{
        type: Number,
        required: true
    },
    is_AC: {
        type: Boolean,
        default: false
    },
    is_luggage_carrier: {
        type: Boolean,
        default: false
    },
    licence_plate: {
        type: String,
    },
    no_of_person: {
        type: Number,
        default: 5
    },
    avg_rating:{
        type: Number,
    },
    transmission: {
        type: String,
        enum: ["manual", "automatic"],
    },
    milage: {
        type: String,
        enum: ["open","limited"]
    },
    class: {
        type: String,
        enum: ["economy", "luxury", "suv", "family"]
    },
    driving_eligibility_criteria: {
        type: Number,
        default: 18,
    },
    is_avialable: {
        type: Boolean,
        default: true
    },
    is_delieverd: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {type: Date, default: Date.now}
}, {versionKey: false});

// Compile model from schema
var Car = mongoose.model('cars', CarSchema, 'cars');
module.exports = Car;