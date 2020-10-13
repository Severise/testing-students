var express = require('express');
var app = express();
var path = require('path');
var passport = require('passport');
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var session = require('express-session')
var LocalStrategy = require('passport-local').Strategy;
var md5 = require('md5');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.json());
app.use(session({ secret: 'secret' }));

app.use(passport.initialize());
app.use(passport.session());
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'db_shop_main'
});


app.set('view engine', 'pug');
// app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/views'));
app.use(express.static(__dirname + '/views/img'));
app.use(express.static(__dirname + '/views/includes'));
connection.connect();


var userList = [];
passport.use(new LocalStrategy({ usernameField: 'login', passwordField: 'password' },
    function(login, password, done) {
        if (userList.find(function(element) {
                return element.login === login && element.password === md5(password);
            }) !== undefined) {
            let user = userList.find(function(element) {
                return element.login === login && element.password === md5(password);
            });
            return done(null, user);
        } else
            return done(null, false);
    }
));


app.get('/error', (req, res) => {
    res.render('error', { auth: true });
})

var roles = [];
app.get('/', (req, res) => {
    if (userList != null)
        connection.query('SELECT users.id, login, password, name, role from users, roles WHERE role_id=roles.id', function(err, rows, fields) {
            if (!err) {
                for (var i = 0; i < rows.length; i++) {
                    var userItem = {
                        'id': rows[i].id,
                        'login': rows[i].login,
                        'password': rows[i].password,
                        'role': rows[i].role,
                    }
                    userList.push(userItem);
                }
            }
        });

    connection.query('SELECT id, descr from roles', function(err, rows, fields) {
        if (!err) {
            roles = [];
            for (var i = 0; i < rows.length; i++) {
                var role = {
                    'id': rows[i].id,
                    'descr': rows[i].descr,
                }
                roles.push(role);
            }
        }
    });

    res.render('auth', { error: req.query.e, auth: true });

})

app.post('/login', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/?e=true'
}));

app.get('/profile', authentication(), (req, res) => {
    if (session.role == 'admin')
        res.render('admin', { 'username': session.login, 'roles': roles, "code": req.query.code });
    else if (session.role == 'manager')
        res.render('manager', { 'username': session.login, "code": req.query.code });
    else if (session.role == 'courier')
        // res.render('courier', { 'username': session.login, "code": req.query.code });
        res.redirect('orderList');
    else if (session.role == 'clad') {
        connection.query("SELECT catalog.id, name, size, quantity, art, price, img from catalog, sizes WHERE size_id=sizes.id",
            function(err, rows, fields) {
                if (err) {
                    res.redirect('/profile?code=404');
                } else {
                    var goods = [];
                    for (var i = 0; i < rows.length; i++) {
                        var good = {
                            "id": rows[i].id,
                            "name": rows[i].name,
                            "size": rows[i].size,
                            "quantity": rows[i].quantity,
                            "art": rows[i].art,
                            "category": 1,
                            "price": rows[i].price,
                            "img": rows[i].img,
                        }
                        goods.push(good);
                    }
                    res.render('store', { 'username': session.login, "code": req.query.code, "goods": goods });
                }
            });

    } else res.redirect('/');
})

app.get('/logout', authentication(), (req, res) => {
    req.logout();
    req.session.destroy();
    res.redirect('/');
});


app.get('/userList', authentication(), (req, res) => {
    var users = [];
    if (session.role == 'admin') {
        connection.query("SELECT users.id, name, login, email, roles.descr from users, roles WHERE role_id=roles.id ORDER by users.id",
            function(err, rows, fields) {
                if (!err) {
                    for (var i = 0; i < rows.length; i++) {
                        var uItem = {
                            'id': rows[i].id,
                            'name': rows[i].name,
                            'login': rows[i].login,
                            'email': rows[i].email,
                            'role': rows[i].descr,
                        }
                        users.push(uItem);
                    }
                    res.render('userList', { "username": session.login, 'users': users, 'roles': roles, "code": req.query.code });
                } else
                    res.redirect('/profile?code=404');
            });

    } else {
        res.redirect('error');
    }
})

app.post('/userList/changeUser', authentication(), (req, res) => {
    var user = {
        "id": req.body.id,
        "name": req.body.name,
        "login": req.body.login,
        "email": req.body.email,
        "role": req.body.role,
    }
    connection.query("UPDATE `users` SET `name` = '" + user.name + "', `role_id` = '" +
        user.role + "', `login` = '" + user.login + "', `email` = '" + user.email + "' WHERE id=" + user.id,
        function(err, rows, fields) {
            if (err)
                res.redirect('/userList?code=404');
            else
                res.redirect('/userList?code=202');
        });
});


app.get('/goodList', authentication(), (req, res) => {

    sortCat = "";
    searchCat = "";
    searchSize = "";

    if (req.query.pr) sortCat = req.query.pr
    if (req.query.search != null)
        searchCat = " && (catalog.name LIKE \'%" + req.query.search + "%\'||catalog.art LIKE \'%" + req.query.search + "%\') "

    if (req.query.searchSize != null)
        searchSize = " && (size LIKE \'%" + req.query.searchSize + "%\') "
    connection.query("SELECT catalog.id, name, size, quantity, art, price, img, rate from catalog, sizes WHERE size_id=sizes.id " +
        searchCat + searchSize + sortCat,
        function(err, rows, fields) {
            if (err) {
                res.redirect('/profile?code=404');
            } else {
                var goods = [];
                for (var i = 0; i < rows.length; i++) {
                    var good = {
                        "id": rows[i].id,
                        "name": rows[i].name,
                        "size": rows[i].size,
                        "quantity": rows[i].quantity,
                        "art": rows[i].art,
                        "category": 1,
                        "price": rows[i].price,
                        "img": rows[i].img,
                        "rate": rows[i].rate,
                    }
                    goods.push(good);
                }
                res.render('goodList', { "goods": goods, "username": session.login, "code": req.query.code, "role": session.role });
            }
        });
})

app.post('/goodList/changeGood', authentication(), (req, res) => {
    var good = {
        "id": req.body.id,
        "name": req.body.name,
        "size_id": req.body.size,
        "quantity": req.body.quantity,
        "art": req.body.art,
        "category": 1,
        "price": req.body.price,
        "img": req.body.img,
    }

    connection.query("UPDATE catalog, sizes SET `name` = \'" + good.name + "\', `size_id` = sizes.id, `quantity` = " + good.quantity + ", `art` = \'" + good.art +
        "\', `price` = \'" + good.price + "\', img=\'" + good.img + "\' WHERE catalog.id = " + good.id + " && sizes.size=" + good.size_id,
        function(err, rows, fields) {
            if (err)
                res.redirect('/goodList?code=404');
            else
                res.redirect('/goodList?code=202');
        });
});

app.get('/custList', authentication(), (req, res) => {
    var customerList = [];
    searchCustomer = "";

    if (req.query.search != null) {
        searchCustomer = " WHERE (customers.name LIKE \'%" + req.query.search + "%\'||customers.address LIKE \'%" + req.query.search + "%\') "
    }

    connection.query("SELECT id, name, address, phone, sum, disc from customers" + searchCustomer,
        function(err, rows, fields) {
            if (!err) {
                for (var i = 0; i < rows.length; i++) {
                    var customer = {
                        'id': rows[i].id,
                        'name': rows[i].name,
                        'address': rows[i].address,
                        'phone': rows[i].phone,
                        'sum': rows[i].sum,
                        'disc': rows[i].disc
                    }
                    customerList.push(customer);
                }
                res.render('custList', { "customers": customerList, "username": session.login, "code": req.query.code });
            } else
                res.redirect('/profile?code=404');
        });
});


app.post('/custList/changeCust', authentication(), (req, res) => {
    connection.query('UPDATE `customers` SET `name` = \'' + req.body.name + '\', `address` = \'' + req.body.address +
        '\', `phone` = \'' + req.body.phone + '\', `sum` = \'' + req.body.sum + '\', `disc` = \'' + req.body.disc + '\' WHERE `id` =' + req.body.id,
        function(error, results, fields) {
            if (error)
                res.redirect('/custList?code=404');
            else
                res.redirect('/custList?code=202');
        });
});

app.post('/profile/addUser', authentication(), (req, res) => {
    connection.query("SELECT login from users WHERE login= \"" + req.body.login + "\"", function(err, rows, fields) {
        if (!err) {
            if (rows.length > 0) {
                res.redirect('/profile?code=401');
            } else {
                var user = {
                    "name": req.body.name,
                    "login": req.body.login,
                    "password": md5(req.body.password),
                    "email": req.body.email,
                    "role_id": parseInt(req.body.role)
                }
                connection.query('INSERT INTO users SET ?', user, function(error, results, fields) {
                    if (error)
                        res.redirect('/profile?code=404');
                    else
                        res.redirect('/profile?code=201');
                });
            }
        } else res.redirect('/profile?code=404');
    });
});

app.post('/profile/addGood', authentication(), (req, res) => {
    connection.query("SELECT art from catalog WHERE art= \"" + req.body.art + "\"", function(err, rows, fields) {
        if (!err) {
            if (rows.length > 0)
                res.redirect('/profile?code=401');
            else {
                //тут вот так сделал
                var arr = [34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46]
                var good = {
                    "name": req.body.name,
                    "size_id": arr.indexOf(parseInt(req.body.size)),
                    "quantity": req.body.quantity,
                    "art": req.body.art,
                    "category": 1,
                    "price": req.body.price,
                    "img": req.body.img,
                }
                connection.query('INSERT INTO catalog SET ? ', good, function(error, results, fields) {
                    if (error)
                        res.redirect('/profile?code=404');
                    else
                        res.redirect('/profile?code=201');
                });
            }
        } else
            res.redirect('/profile?code=404');
    });

});

app.post('/profile/addCust', authentication(), (req, res) => {
    connection.query("SELECT phone from customers WHERE phone= \"" + req.body.phone + "\"", function(err, rows, fields) {
        if (!err) {
            if (rows.length > 0)
                res.redirect('/profile?code=401');
            else {
                var customer = {
                    "name": req.body.name,
                    "address": req.body.address,
                    "phone": req.body.phone,
                    "sum": 0,
                    "disc": req.body.disc,
                }
                connection.query('INSERT INTO customers SET ?', customer, function(error, results, fields) {
                    if (error)
                        res.redirect('/profile?code=404');
                    else
                        res.redirect('/profile?code=201');
                });
            }
        } else
            res.redirect('/profile?code=404');
    });
});

app.get('/addOrder', authentication(), (req, res) => {
    var goods = [];
    connection.query("SELECT catalog.id, name, size, quantity, art, price, img, rate from catalog, sizes WHERE size_id=sizes.id", function(err, rows, fields) {
        if (err) {
            res.redirect('/profile?code=404');
        } else {
            for (var i = 0; i < rows.length; i++) {
                var good = {
                    "id": rows[i].id,
                    "name": rows[i].name,
                    "size": rows[i].size,
                    "quantity": rows[i].quantity,
                    "art": rows[i].art,
                    "category": 1,
                    "price": rows[i].price,
                    "img": rows[i].img,
                    "rate": rows[i].rate,
                }
                goods.push(good);
            }
            connection.query("SELECT COUNT(DISTINCT good_id) as count FROM `temp_baskets` WHERE user_id=" + session.id, function(error, result, fields) {
                if (error)
                    res.redirect('/profile?code=404');
                else {
                    res.render('addOrder', { "goods": goods, "username": session.login, "code": req.query.code, "cart": result[0].count });
                }
            });

        }
    });
});


app.post('/takeGood', authentication(), (req, res) => {

    connection.query('INSERT INTO temp_baskets (`good_id`, `quantity`, `user_id`) VALUES (' + req.body.good +
        ', ' + req.body.quantity + ', ' + session.id + ')',
        function(error, results, fields) {
            if (error)
                res.redirect('/addOrder?code=404');
            // else {
            //     // res.setHeader('Content-Type', 'application/json');
            //     // res.send(JSON.stringify({ success: true }));
            // }
        });
});

app.get('/order', authentication(), (req, res) => {
    var goods = [];
    connection.query("SELECT good_id as id, catalog.name, size,  sum(temp_baskets.quantity) as quantity, " +
        "catalog.price from temp_baskets, catalog, sizes WHERE good_id=catalog.id && size_id=sizes.id && user_id=" + session.id + " group by good_id",
        function(err, rows, fields) {
            if (err) {
                res.redirect('/profile?code=404');
            } else {
                for (var i = 0; i < rows.length; i++) {
                    var good = {
                        "id": rows[i].id,
                        "name": rows[i].name,
                        "size": rows[i].size,
                        "quantity": rows[i].quantity,
                        "price": rows[i].price,
                    }
                    goods.push(good);
                }
                res.render('order', { "goods": goods, "username": session.login, "code": req.query.code, 'id': req.query.id, 'quant': req.query.quant });

            }
        });


});


app.post('/changeTakenGood', authentication(), (req, res) => {
    connection.query('DELETE FROM `temp_baskets` WHERE good_id=' + req.body.good + ' && user_id=' + session.id, function(err, result, fields) {
        if (err)
            res.redirect('/order?code=404');
        else {
            connection.query('INSERT INTO `temp_baskets`( `good_id`, `quantity`, `user_id`) VALUES ( ' + req.body.good + ', ' +
                req.body.quantity + ', ' + session.id + ')',
                function(err, result, fields) {
                    if (err)
                        res.redirect('/order?code=404');
                    else res.redirect('/order?code=203');
                });
        }
    });
});

app.post('/makeOrder', authentication(), (req, res) => {
    var data = JSON.parse(req.body.data);
    var ids = [];
    for (var i = 0; i < data.length; i++) {
        ids.push(parseInt(data[i].id));
    }

    connection.query('SELECT id, quantity FROM catalog WHERE id in (' + ids.toString() + ')', function(error, rows, fields) {
        if (error)
            return res.redirect('/order?code=404');
        else {
            for (var i = 0; i < rows.length; i++)
                for (var j = 0; j < data.length; j++)
                    if (rows[i].id == data[j].id) {
                        if (rows[i].quantity < data[j].quantity)
                            return res.redirect('/order?code=403&id=' + (j + 1) + '&quant=' + rows[i].quantity);
                        break;
                    }
            var date = new Date();

            var minzero = '';
            var seczero = '';
            if (parseInt(date.getMinutes()) < 10)
                minzero = '0';
            if (parseInt(date.getSeconds()) < 10)
                seczero = '0';
            date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() +
                ":" + minzero + date.getMinutes() + ":" + seczero + date.getSeconds();
            connection.query('INSERT INTO orders (user_id,date) VALUES (' + session.id + ',"' + date + '")', function(err, rows, fields) {
                if (err)
                    return res.redirect('/order?code=404');
                else {
                    connection.query('SELECT id FROM orders WHERE user_id=' + session.id + ' && date="' + date + '" ORDER BY id DESC LIMIT 1', function(error, rows, fields) {
                        if (err)
                            return res.redirect('/order?code=404');
                        else {
                            var orderId = rows[0].id;
                            var params = [];
                            for (var i = 0; i < data.length; i++) {
                                params.push([]);
                                params[i].push(parseInt(data[i].id), parseInt(data[i].quantity), data[i].sum, orderId, session.id);
                            }
                            connection.query('INSERT INTO baskets (`good_id`, `quantity`,`sum`, order_id, user_id) VALUES ?', [params], function(error, rows, fields) {
                                if (error)
                                    return res.redirect('/order?code=404');
                                else {
                                    connection.query('DELETE FROM temp_baskets WHERE good_id in (' + ids.toString() + ') && user_id=' + session.id, function(error, rows, fields) {
                                        if (error)
                                            return res.redirect('/order?code=404');

                                        else {
                                            for (var i = 0; i < data.length; i++) {
                                                var good = data[i].id;
                                                var qua = parseInt(data[i].quantity);
                                                connection.query('UPDATE catalog SET quantity=quantity-' + qua + ',rate=rate+' + qua + ' WHERE id=' + good, function(error, rows, fields) {
                                                    if (error)
                                                        return res.redirect('/order?code=404');
                                                });
                                            }
                                            return res.redirect('/confirmOrder?order=' + orderId + '&date=' + date);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
});

app.get('/confirmOrder', authentication(), (req, res) => {
    connection.query('SELECT id, name, address, disc FROM customers', function(error, rows, fields) {
        if (error)
            return res.redirect('/order?code=404');
        else {
            customers = [];
            for (var i = 0; i < rows.length; i++) {
                var customer = {
                    'id': rows[i].id,
                    'name': rows[i].name,
                    'address': rows[i].address,
                    'disc': rows[i].disc
                }
                customers.push(customer);
            }
            var id = req.query.order;
            connection.query('SELECT SUM(sum) as sum FROM baskets WHERE order_id=' + id, function(error, rows, fields) {
                if (error)
                    return res.redirect('/order?code=404');
                else {
                    var sum = rows[0].sum;

                    res.render('confirmOrder', { 'id': id, 'username': session.login, 'date': req.query.date, 'customers': customers, 'sum': sum });
                }
            });
        }
    });
});

app.post('/completeOrder', authentication(), (req, res) => {

    connection.query('UPDATE `orders` SET `customer_id`=' + req.body.customer + ', `address`="' + req.body.address + '",`state_id`=1, `sum`=' + req.body.sum + ', `additional`="' +
        req.body.additional + '" WHERE orders.id=' + req.body.id,
        function(error, rows, fields) {
            if (error)
                res.redirect('/order?code=404');
            else {
                connection.query('UPDATE `customers` SET sum=sum+' + req.body.sum + ' WHERE customers.id=' + req.body.customer, function(error, rows, fields) {
                    if (error)
                        res.redirect('/orderList?code=406');
                    else
                        res.redirect('/orderList?code=204');
                });
            }
        });
});


app.get('/orderList', authentication(), (req, res) => {
    console.log(session.role);
    var q = '';
    if (session.role == 'courier') {
        var q = 'SELECT orders.id as id, customers.name as customer, orders.address, date,' +
            ' states.descr as state, additional, orders.sum as sum, users.name as user, courier_id as courier FROM orders, customers, states, users WHERE customers.id=orders.customer_id' +
            ' && states.id=orders.state_id && orders.user_id=users.id && courier_id=' + session.id;
    } else q = 'SELECT orders.id as id, customers.name as customer, orders.address, date, states.descr as state, additional, orders.sum as sum, users.name as user, ' +
        'couriers.name as courier FROM orders, customers, states, users, users as couriers WHERE customers.id=orders.customer_id && states.id=orders.state_id && ' +
        'orders.user_id=users.id && courier_id=couriers.id && couriers.role_id=2 UNION SELECT orders.id as id, customers.name as customer, orders.address, date,' +
        ' states.descr as state, additional, orders.sum as sum, users.name as user, courier_id as courier FROM orders, customers, states, users WHERE customers.id=orders.customer_id' +
        ' && states.id=orders.state_id && orders.user_id=users.id && courier_id=0';
    connection.query(q, function(error, rows, fields) {
        if (error)
            res.redirect('/profile?code=404');
        else {
            var orders = [];
            var date;
            var minzero = '';
            for (var i = 0; i < rows.length; i++) {
                date = rows[i].date;
                if (parseInt(date.getMinutes()) < 10)
                    minzero = '0';
                date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + minzero + date.getMinutes();
                minzero = '';

                var order = {
                    'id': rows[i].id,
                    'customer': rows[i].customer,
                    'address': rows[i].address,
                    'date': date,
                    'state': rows[i].state,
                    'additional': rows[i].additional,
                    'sum': rows[i].sum,
                    'user': rows[i].user,
                    'courier': rows[i].courier
                }
                orders.push(order);
            }
            connection.query('SELECT id, descr as state FROM states', function(error, rows, fields) {
                if (error)
                    res.redirect('/profile?code=404');
                else {
                    var states = [];
                    for (var i = 0; i < rows.length; i++) {
                        var state = {
                            'id': rows[i].id,
                            'state': rows[i].state,
                        }
                        states.push(state);
                    }
                    connection.query('SELECT id, name FROM users WHERE role_id=2', function(error, rows, fields) {
                        if (error)
                            res.redirect('/profile?code=404');
                        else {
                            var couriers = [];
                            for (var i = 0; i < rows.length; i++) {
                                var courier = {
                                    'id': rows[i].id,
                                    'name': rows[i].name,
                                }
                                couriers.push(courier);
                            }

                            res.render('orderList', { 'username': session.login, 'code': req.query.code, 'orders': orders, 'states': states, 'couriers': couriers, 'role': session.role });
                        }
                    });
                }
            });
        }
    });
});

app.post('/orderList/changeOrder', authentication(), (req, res) => {
    var order = {
        "id": req.body.id,
        "address": req.body.address,
        "state_id": req.body.state,
        "courier_id": req.body.courier,
        "additional": req.body.additional
    }

    connection.query("UPDATE orders SET `address`='" + order.address + "', `state_id`=" + order.state_id + ", `courier_id`=" +
        order.courier_id + ", `additional`='" + order.additional + "' WHERE orders.id=" + order.id,
        function(err, rows, fields) {
            if (err)
                res.redirect('/orderList?code=404');
            else
                res.redirect('/orderList?code=202');
        });
});
app.get('/orderCard', authentication(), (req, res) => {
    var shopList = [];
    sumOrder = 0;
    connection.query("SELECT orders.id, customers.name \"customer\", orders.sum, orders.address, additional, states.descr, role, orders.date, users.name \"user\", catalog.name \"good\", size, baskets.quantity, baskets.sum \"sumgood\" from orders, customers, users, catalog, baskets, sizes, roles, states WHERE role_id=roles.id && customers.id=customer_id && orders.user_id=users.id && baskets.order_id=orders.id && catalog.id = baskets.good_id && sizes.id = size_id && states.id = orders.state_id && orders.id=" + req.query.id, function(err, rows, fields) {
        if (err) {
            res.send("Ничего не найдено");
        } else {
            console.log(rows);
            var date = rows[0].date;
                var minzero = '';
            var seczero = '';
            if (parseInt(date.getMinutes()) < 10)
                minzero = '0';
            if (parseInt(date.getSeconds()) < 10)
                seczero = '0';
            date = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() +
                ":" + minzero + date.getMinutes() + ":" + seczero + date.getSeconds();
            for (var i = 0; i < rows.length; i++) {

                var order = {
                    "id": rows[i].id,
                    "customer": rows[i].customer,
                    "sum": rows[i].sum,
                    "additional": rows[i].additional,
                    "address": rows[i].address,
                    "status": rows[i].descr,
                    "role": rows[i].role,
                    "date": date,
                    "user": rows[i].user,

                }


                var orderCard = {
                    "good": rows[i].good,
                    "size": rows[i].size,
                    "sumgood": rows[i].sumgood,
                    "quantity": rows[i].quantity,
                }
                sumOrder += parseInt(rows[i].sumgood)
                shopList.push(orderCard);
            }
            res.render('orderCard', {
                "shopList": shopList,
                "userN": session.login,
                "order": order,
                "sum": sumOrder
            });

        }
    });

})
app.get('/basketList', authentication(), (req, res) => {
    connection.query('SELECT baskets.id, order_id, catalog.name as good, baskets.quantity , baskets.sum FROM `baskets`, catalog WHERE good_id=catalog.id', function(error, rows, fields) {
        if (error)
            res.redirect('/profile?code=404');
        else {
            var baskets = [];
            for (var i = 0; i < rows.length; i++) {
                var basket = {
                    'id': rows[i].id,
                    'order_id': rows[i].order_id,
                    'good': rows[i].good,
                    'quantity': rows[i].quantity,
                    'sum': rows[i].sum
                }
                baskets.push(basket);
            }
            res.render('basketList', { 'username': session.login, 'code': req.query.code, 'baskets': baskets });
        }
    });
});


app.get('*', authentication(), (req, res) => {
    if (!!session.login)
        res.redirect('profile');
    else
        res.redirect('/');
});

function authentication() {
    return function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/');
    }
}

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    const user = userList.find(function(e) {
        return e.id === id;
    });

    if (user !== undefined) {
        session.login = user.login;
        session.id = user.id;
        session.role = user.role;
        done(null, user);
    } else {
        done(null, false);
    }

});


app.listen(3000, function() {
    console.log('listening on port', 3000);
});