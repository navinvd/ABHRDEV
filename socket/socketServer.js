var io = require('socket.io')();
var _ = require("underscore");
var socketFunction = {}
var Groups = new Map();
var UsersSockets = new Map();
var AgentsSockets = new Map();
var AdminSockets = new Map();
var allSockets = new Map();
var async = require("async");
var ObjectId = require('mongoose').Types.ObjectId;
var CarBooking = require('./../models/car_booking');

socketFunction.socketStartUp = function (server) {
    try {
        io.attach(server);
        io.on('connection', function (client) {

            client.on('message', (msg)=>{
                console.log('msg==>',msg);
            });
        /**
		 * @api {socket on} JoinGroup  To Join Group
		 * @apiName Get Group Channels
		 * @apiGroup  Sokets
		 * @apiParam {JSON} data Data of user
		 */
        client.on('JoinGroup', async function (data) {
            var BookingId = data.booking_id;
            var user_id = data.user_id;
            var type = data.type;
            
            var allsocketobj = {
                "user_id": user_id,
                "type": type
            }
            allSockets.set(client.id, allsocketobj);
            var Booking = Groups.get(BookingId);
            var location = await CarBooking.findOne({ "_id": new ObjectId(BookingId)});
            console.log('location=======>', location);
            if (Booking) {
                if (type === 'agent') {
                    if (typeof Booking['agentId'] === 'undefined' || Booking['agentId'] === null) { 
                        let obj = { ...Booking, agentId: user_id }
                        Groups.set(BookingId, obj);
                    }
                    var Agentsocket = AgentsSockets.get(user_id);
                    if(typeof Agentsocket === 'undefined'){
                        let obj = {
                            socketIds: [client.id]
                        }
                        AgentsSockets.set(user_id, obj);
                    }else{
                        Agentsocket.socketIds.push(client.id);
                    }
                } else if( type === 'user'){
                    if (typeof Booking['userId'] === 'undefined' || Booking['userId'] === null) { 
                        let obj = { ...Booking, userId: user_id }
                        Groups.set(BookingId, obj);
                    }
                    var Usersocket = UsersSockets.get(user_id);
                    if(typeof Usersocket === 'undefined'){
                        let obj = {
                            socketIds: [client.id]
                        }
                        UsersSockets.set(user_id, obj);
                    }else{
                        Usersocket.socketIds.push(client.id);
                    }
                } else if( type === 'admin'){
                    if (typeof Booking['adminId'] === 'undefined' || Booking['adminId'] === null) { 
                        let obj = { ...Booking, adminId: user_id }
                        Groups.set(BookingId, obj);
                    }
                    var Adminsocket = AdminSockets.get(user_id);
                    if(typeof Adminsocket === 'undefined'){
                        let obj = {
                            socketIds: [client.id]
                        }
                        AdminSockets.set(user_id, obj);
                    }else{
                        Adminsocket.socketIds.push(client.id);
                    }
                }
            } else {
                if (type === 'agent') {
                    let bobj = { agentId: user_id }
                    Groups.set(BookingId, bobj);
                    var Agentsocket = AgentsSockets.get(user_id);
                    if(typeof Agentsocket === 'undefined'){
                        let sobj = {
                            socketIds: [client.id]
                        }
                        AgentsSockets.set(user_id, sobj);
                    }else{
                        Agentsocket.socketIds.push(client.id);
                    }
                } else if (type === 'user') {
                    let bobj = { userId: user_id }
                    Groups.set(BookingId, bobj);
                    var Usersocket = UsersSockets.get(user_id);
                    if(typeof Usersocket === 'undefined'){
                        let sobj = {
                            socketIds: [client.id]
                        }
                        UsersSockets.set(user_id, sobj);
                    }else{
                        Usersocket.socketIds.push(client.id);
                    }
                } else if (type === 'admin') {
                    let bobj = { adminId: user_id }
                    Groups.set(BookingId, bobj);
                    var Adminsocket = AdminSockets.get(user_id);
                    if(typeof Adminsocket === 'undefined'){
                        let sobj = {
                            socketIds: [client.id]
                        }
                        AdminSockets.set(user_id, sobj);
                    }else{
                        Adminsocket.socketIds.push(client.id);
                    }
                }
            }
            if(location.trip_status === "delivering"){
                var obj = {
                    "destination_location": {"longitude": location.longitude, "latitude" : location.latitude},
                    "source_location": {"longitude": location.deliever_source_location[0], "latitude" : location.deliever_source_location[1]},
                    "last_location" : {"longitude": location.last_location[0], "latitude" : location.last_location[1]}
                }
                console.log(obj);
                io.to(client.id).emit("Joined", obj);
            }
            if(location.trip_status === "returning"){
                var obj = {
                    "destination_location": {"longitude": location.longitude, "latitude" : location.latitude},
                    "source_location": {"longitude": location.return_source_location[0], "latitude" : location.return_source_location[1]},
                    "last_location" : {"longitude": location.last_location[0], "latitude" : location.last_location[1]}
                }
                console.log('obj====>',obj);
                io.to(client.id).emit("Joined", obj);
            }
            console.log('joinsocket group==>', Groups);
            console.log('user Sockets===>', UsersSockets);
            console.log('admin Sockets===>', AdminSockets);
            console.log('agent Sockets===>', AgentsSockets);
            console.log('all Sockets===>', allSockets);
        });

        client.on('sendTrakingObject', async function (data) {
            console.log('sendTrackingObject===>', data);
            try { 
                var location = [ data.Longitude, data.Latitude ];
                var BookingId = data.booking_id;
                var agent_id = data.agent_id;
                var update = CarBooking.update({ "_id": new ObjectId(BookingId)}, { $set : { "last_location": location}}, function(err, res){
                    console.log( err, res);
                });
                
                console.log('update query======>', update);
                var checkBooking = Groups.get(BookingId);
                if(checkBooking){
                    var checkadmin = AdminSockets.get(checkBooking['adminId']);
                    if(checkadmin){
                        var checkadmins = checkadmin && checkadmin.socketIds && checkadmin.socketIds.length > 0 ? checkadmin.socketIds : [];
                        if(checkadmins.length !==0){
                            console.log('check admins===>', checkadmins);
                            checkadmins.forEach((value)=>{
                                io.to(value).emit("recieveTrackingObject", data);
                            });
                        }
                    }
                    var checkuser = UsersSockets.get(checkBooking['userId']);
                    if(checkuser){
                        var checkusers = checkuser && checkuser.socketIds && checkuser.socketIds.length > 0 ? checkuser.socketIds : [];
                        if(checkusers.length >0){
                            console.log('check users===>', checkusers);
                            checkusers.forEach((value)=>{
                                console.log('emitting data====>',data);
                                io.to(value).emit("recieveTrackingObject", data);
                            });
                        }
                    }
                }
            } catch(e){
                console.log('err==>', e);
            }

            console.log('joinsocket group==>', Groups);
            console.log('user Sockets===>', UsersSockets);
            console.log('admin Sockets===>', AdminSockets);
            console.log('agent Sockets===>', AgentsSockets);
            console.log('all Sockets===>', allSockets);
        });

        client.on('LeftGroup', function () {
            var socketId = this.id;
            console.log('leftgrp===>',socketId);
            var user = allSockets.get(socketId);
            if(user){
                if(user.type === 'admin'){
                    var checkadmin = AdminSockets.get(user.user_id);
                    if(checkadmin.socketIds.length !== 0){
                        checkadmin = checkadmin.socketIds.filter(item => item !== socketId);
                        let obj = {
                            socketIds: checkadmin
                        }
                        AdminSockets.set(user.user_id, obj);
                        if(checkadmin.length === 0){
                            AdminSockets.delete(user.user_id);
                        }
                    }
                } else if(user.type === 'agent'){
                    var checkagent = AgentsSockets.get(user.user_id);
                    if(checkagent.socketIds.length !== 0){
                        checkagent = checkagent.socketIds.filter(item => item !== socketId);
                        let obj = {
                            socketIds: checkagent
                        }
                        AgentsSockets.set(user.user_id, obj);
                        if(checkagent.length === 0){
                            AgentsSockets.delete(user.user_id);
                        }
                    }
                } else if(user.type === 'user'){
                    var checkuser = UsersSockets.get(user.user_id);
                    if(checkuser.socketIds.length !== 0){
                        checkuser = checkuser.socketIds.filter((item) =>  {return item !== socketId});
                        let obj = {
                            socketIds: checkuser
                        }
                        UsersSockets.set(user.user_id, obj);
                        if(checkuser.length === 0){
                            UsersSockets.delete(user.user_id);
                        }
                    }
                }
                allSockets.delete(socketId);
            }
            console.log('joinsocket group==>', Groups);
            console.log('user Sockets===>', UsersSockets);
            console.log('admin Sockets===>', AdminSockets);
            console.log('agent Sockets===>', AgentsSockets);
            console.log('all Sockets===>', allSockets);
        });

        // client.on('recieveTrackingObjest', (data)=> {
        //     console.log('in recieve===>', data);
        // });

        //     client.on('myowntest', function (data) {
        //         // console.log('socket_id===>',socket);
        //         console.log("data => myowntest ", data);
        //     });

            

        //     client.on('JoinSocket', function (data) {
        //         console.log('JoinSocket group==>', data);
        //     });
        });

    } catch (e) {
        console.log(e);
    }
}
module.exports = socketFunction;