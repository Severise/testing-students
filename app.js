var express = require('express');
var app = express();
var path = require('path');
var passport = require('passport');
var bodyParser = require("body-parser");

var session = require('express-session');
var LocalStrategy = require('passport-local').Strategy;
var md5 = require('md5');
app.use(express.json());
app.use(session({ secret: 'secret' }));

app.use(passport.initialize());
app.use(passport.session());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.engine('pug', require('pug').__express);

var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'testing'
});

app.set('view engine', 'pug');
app.set('views', __dirname);
app.use(express.static(__dirname));
app.use(express.static(__dirname + '/public'));

var tryUser;

function authentication() {
    return function(req, res, next) {
        if (req.isAuthenticated()) {
            return next();
        }
        res.redirect('/');
    }
}

passport.use(new LocalStrategy({ usernameField: 'login', passwordField: 'password' },
    function(login, password, done) {
        console.log('passport.use');
        connection.query("select * from users where login = '" + login + "' and password='" + password + "'", function(err, rows, fields) {
            if (rows[0]) {
                if (err)
                    throw err;
                tryUser = rows[0];
                return done(null, tryUser);
            } else
                return done(null, false);
        });
    }
));

app.get('/', (req, res) => {
    console.log('get//');
    res.redirect('menu');
});

app.get('/menu', (req, res) => {
    console.log('get/menu');
    connection.query('SELECT tests.id as id, tests.name as name, users.name as owner FROM tests, users where is_enabled=1 and users.id=tests.owner', function(err, rows, fields) {
        if (err || rows.length < 1)
            res.render('menu', { notests: true });
        else {
            var tests = [];
            var owners = [];
            for (var i = 0; i < rows.length; i++) {
                var test = {
                    id: rows[i].id,
                    name: rows[i].name,
                    owner: rows[i].owner
                };
                if (!owners.includes(rows[i].owner))
                    owners.push(rows[i].owner);
                tests.push(test);
            }
            res.render('menu', { tests: tests, owners: owners });
        }
    });
});


app.post('/login', passport.authenticate('local', {
    successRedirect: '/user',
    failureRedirect: '/menu?auth=false'
}));

app.get('/logout', authentication(), (req, res) => {
    req.logout();
    req.session.destroy();
    user = null;
    res.redirect('/menu');
});


app.get('/test', (req, res) => {
    console.log('get/test');
    if (!req.query.id)
        res.redirect('menu');
    else
        connection.query("select tests.name as test, tests.is_enabled, questions.id as id, questions.name as quest, options.id as opt_id, options.value as opt, options.is_answer as c_ans from tests, questions, options where tests.id=" + req.query.id + " and questions.test_id=tests.id and questions.id=options.question_id", function(err, rows, fields) {
            if (err)
                res.redirect('menu?error');
            else if (rows.length <= 0)
                res.redirect('menu')
            else {
                if (rows[0].is_enabled || req.query.preview) {
                    var quests = [];
                    for (var i = 0; i < rows.length; i++) {
                        var opts = [];
                        var check = 0;
                        var q = rows[i].quest;
                        do {
                            if (rows[i].c_ans == 1)
                                check++;
                            var opt = {
                                id: rows[i].opt_id,
                                name: rows[i].opt
                            }
                            opts.push(opt);
                            i++;
                        } while (i < rows.length && rows[i].quest == q)
                        i--;
                        var quest = {
                            id: rows[i].id,
                            name: rows[i].quest,
                            options: opts,
                            amount: check
                        };
                        quests.push(quest);
                    }
                    var test = {
                        name: rows[0].test,
                        quests: quests
                    };
                    res.render('test', { test: test, preview: req.query.preview, user: user });
                } else
                    res.redirect('menu?access=false');
            }
        });
});


app.post('/test', (req, res) => {
    console.log('post/test');
    var stud;

    connection.query("SELECT id FROM `students`  WHERE `name`='" + req.body.name.toString().toLowerCase() + "' AND `surname`='" + req.body.surname.toString().toLowerCase() + "' AND `group`=" + req.body.group + " limit 1", function(err, row, field) {
        if (!!row && row.length > 0)
            sendRes(row[0].id, req, res);
        else {
            connection.query("INSERT INTO `students` (`name`, `surname`, `group`) values ('" + req.body.name.toString().toLocaleLowerCase() + "', '" + req.body.surname.toString().toLocaleLowerCase() + "', " + req.body.group + ")", function(err, rows, fields) {
                if (err) {
                    backURL = req.header('Referer') || '/';
                    console.log('res.redirect(backURL');
                    res.redirect(backURL + '&error');
                } else
                    stud = rows.insertId;
                sendRes(stud, req, res);
            });
        }
    });
});

function sendRes(stud, req, res) {
    var temp = JSON.stringify(req.body).split('id');
    var ids = [];
    for (var i = 1; i < temp.length; i++)
        ids[i - 1] = temp[i].split('"')[0];
    var query = '';
    var count = 0;
    for (var i = ids[0];; i++) {
        if (count == ids.length)
            break;
        count++;
        if (Array.isArray(req.body['id' + i]))
            req.body['id' + i].forEach(element => query += '(' + stud + ', ' + req.query.id + ', ' + i + ', "' + element + '"),');
        else
            query += '(' + stud + ', ' + req.query.id + ', ' + i + ', "' + req.body['id' + i] + '"),';
    }
    query = query.slice(0, -1);
    // console.log("INSERT INTO `tries` (`student_id`, `test_id`, `question_id`, `answer`) values " + query);
    connection.query("INSERT INTO `tries` (`student_id`, `test_id`, `question_id`, `answer`) values " + query, function(erri, rowi, fieldi) {
        backURL = req.header('Referer') || '/';
        if (erri)
            res.redirect(backURL + '&error');
        else
            res.redirect(backURL + '&send=true');
        connection.query("INSERT INTO `results` (`student_id`, `test_id`, `correct_answers`) SELECT `student_id`, `test_id`, SUM(`is_right`) FROM `tries` WHERE `student_id`=" + stud + " and `test_id`=" + req.query.id, function(err, rows, fields) {
            console.log(err);
        });
    });
}

app.get('/create', authentication(), (req, res) => {
    console.log('get/create');
    res.render('create', { user: user });
});

app.post('/create', authentication(), (req, res) => {
    console.log('post/create');
    console.log(req.body);
    connection.query('insert into `tests` ( `name`, `owner`, `duration`, `max_right`) values ("' + req.body.name + '", ' + user.id + ', ' + req.body.time + ', ' + req.body.max + ')', function(err, row, field) {
        if (err)
            res.redirect('create?error');
        var testId = row.insertId;
        req.body.questions.forEach(element => insertQ(element, testId, res));
    });
    var response = {
        status: 200,
        success: 'Created'
    }
    res.end(JSON.stringify(response));
});

function insertQ(q, testId, res) {
    // console.log('insert into `questions` (`name`, `test_id`) values ("' + q.name + '", ' + testId + ')');
    connection.query('insert into `questions` (`name`, `test_id`) values ("' + q.name + '", ' + testId + ')', function(error, rows, fields) {
        if (error)
            res.redirect('create?error');
        var questId = rows.insertId;
        console.log(q.answers);
        q.answers.forEach(element => insertA(element, questId));
    });
}

function insertA(a, questId, res) {
    // console.log('insert into `options` (`value`, `is_answer`, `question_id`) values (' + a.value + ', ' + a.checked + ', ' + questId + ')');
    connection.query('insert into `options` (`value`, `is_answer`, `question_id`) values ("' + a.value + '", ' + a.checked + ', ' + questId + ')', function(erra, rowa, fielda) {
        if (erra)
            res.redirect('create?error');
    });
}

app.get('/user', authentication(), (req, res) => {
    console.log('get/user');
    connection.query("SELECT * FROM `tests` WHERE `owner`='" + user.id + "'", function(err, rows, fields) {
        if (err)
            res.redirect('user?error');
        var tests = [];

        for (var i = 0; i < rows.length; i++) {
            var test = {
                id: rows[i].id,
                name: rows[i].name,
                enabled: rows[i].is_enabled,
                owner: rows[i].owner
            }
            tests.push(test);
        }
        res.render('user', { tests: tests, user: user });
    });
});

app.get('/tests', authentication(), (req, res) => {
    console.log('get/user');
    connection.query("SELECT * FROM `tests` WHERE `owner`!='" + user.id + "'", function(err, rows, fields) {
        if (err)
            res.redirect('user?error');
        var tests = [];

        for (var i = 0; i < rows.length; i++) {
            var test = {
                id: rows[i].id,
                name: rows[i].name,
                enabled: rows[i].is_enabled,
                owner: rows[i].owner
            }
            tests.push(test);
        }
        res.render('user', { tests: tests, user: user, others: true });
    });
});


app.get('/results', authentication(), (req, res) => {
    console.log('get/results');
    connection.query('SELECT distinct students.group as `group` FROM `students`', function(errg, rowsg, fieldsg) {
        if (errg)
            res.redirect('user?error');
        var groups = [];
        for (var i = 0; i < rowsg.length; i++)
            groups.push(rowsg[i].group);

        connection.query('SELECT distinct tests.name as `test`, tests.id as id FROM `tests` WHERE `owner`=' + user.id, function(errt, rowst, fieldst) {
            if (errt)
                res.redirect('user?error');
            var tests = [];
            for (var i = 0; i < rowst.length; i++) {
                var test = {
                    id: rowst[i].id,
                    name: rowst[i].test
                }
                tests.push(test);
            }
            var gr = '';
            if (req.query.group)
                gr = ' and students.group=' + req.query.group;
            var te = '';
            if (req.query.test)
                te = ' and tests.id=' + req.query.test;
            // console.log('SELECT students.name as name, students.surname as surname, students.group as group, tests.name as test, results.correct_answers as result, tests.max_right as max FROM `results`, `tests`, `students` WHERE results.student_id=students.id and tests.id=results.test_id' + gr + te);
            connection.query('SELECT students.name as name, students.surname as surname, students.group as `group`, tests.name as test, results.correct_answers as result, tests.max_right as max FROM `results`, `tests`, `students` WHERE results.student_id=students.id and tests.id=results.test_id' + gr + te, function(err, rows, fields) {
                if (err)
                    res.redirect('user?error');
                var results = [];
                for (var i = 0; i < rows.length; i++) {
                    var result = {
                        student: rows[i].surname + ' ' + rows[i].name,
                        group: rows[i].group,
                        test: rows[i].test,
                        result: rows[i].result,
                        max: rows[i].max
                    };
                    results.push(result);
                }
                res.render('results', { results: results, groups: groups, tests: tests, user: user, selGroup: req.query.group, selTest: req.query.test });
            });

        });
    });
});

app.get('/edit', authentication(), (req, res) => {
    console.log('get/edit');
    connection.query("select tests.id as test_id, tests.name as test, tests.duration as time, tests.owner as owner, questions.id as question_id, questions.name as question, options.id as opt_id, options.value as opt, options.is_answer as is_answer from tests, questions, options where tests.id=" + req.query.id + " and test_id=" + req.query.id + " and questions.id=options.question_id", function(err, rows, fields) {
        if (err)
            res.redirect('user?error');
        else if (rows.length <= 0)
            res.redirect('menu')
        else if (rows[0].owner != user.id)
            res.redirect('menu?edit=false')
        else {
            var quests = [];

            for (var i = 1; i < rows.length; i++) {
                var opts = [];
                var opt = {
                    id: rows[i - 1].opt_id,
                    value: rows[i - 1].opt,
                    isAnswer: rows[i - 1].is_answer
                }
                opts.push(opt);
                while (i < rows.length && rows[i - 1].question_id == rows[i].question_id) {
                    var opt = {
                        id: rows[i].opt_id,
                        value: rows[i].opt,
                        isAnswer: rows[i].is_answer
                    }
                    opts.push(opt);
                    i++;
                }
                var q = {
                    id: rows[i - 1].question_id,
                    name: rows[i - 1].question,
                    options: opts
                };
                quests.push(q);
            }
            var test = {
                id: rows[0].test_id,
                name: rows[0].test,
                time: rows[0].time,
                questions: quests
            };
            res.render('edit', { test: test, user: user });
        }
    });
});


app.post('/edit', authentication(), (req, res) => {
    console.log('post/edit');
    connection.query('update `tests` set name="' + req.body.name + '", duration=' + req.body.time + ' where id=' + req.body.id, function(err, row, field) {
        if (err)
            res.redirect('create?error');
        else {
            connection.query('delete from questions where test_id=' + req.body.id, function(err, row, field) {
                if (err)
                    res.redirect('edit?error');
                req.body.questions.forEach(element => insertQ(element, req.body.id, res));
                var response = {
                    status: 200,
                    success: 'Edited'
                }
                res.end(JSON.stringify(response));
            });
        }
    });
});


function closeTest(id) {
    console.log('closeTest ' + id);
    connection.query('update `tests` SET `is_enabled`=0 where id=' + id, function(err, rows, fields) {
        console.log(err);
    });
}

app.post('/openClose', authentication(), (req, res) => {
    console.log('post/openClose');
    connection.query('update `tests` SET `is_enabled`=' + req.body.state + ' where id=' + req.body.id, function(err, rows, fields) {
        if (err)
            var response = {
                status: 400,
                error: 'Error'
            }
        else
            var response = {
                status: 200,
                success: 'State' + req.body.state
            }
        res.end(JSON.stringify(response));
        connection.query('SELECT duration FROM `tests` WHERE id=' + req.body.id, function(error, rowst, fieldst) {
            var time = rowst[0].duration;
            setTimeout(closeTest, 60000 * time, req.body.id);
        });
    });
});


app.post('/delete', authentication(), (req, res) => {
    console.log('post/delete');
    connection.query("delete from tests where tests.id=" + req.body.id, function(err, rows, fields) {
        console.log(err);
        if (err)
            var response = {
                status: 400,
                error: 'Error'
            }
        else
            var response = {
                status: 200,
                success: 'Deleted'
            }
        res.end(JSON.stringify(response));
    });
});


app.post('/clone', authentication(), (req, res) => {
    console.log('post/clone');
    console.log("INSERT INTO `tests` (name, owner, duration, max_right) SELECT name, " + user.id + ", duration, max_right FROM `tests` WHERE id = " + req.body.id);
    connection.query("INSERT INTO `tests` (name, owner, duration) SELECT name, " + user.id + ", duration FROM `tests` WHERE id = " + req.body.id, function(err, rows, fields) {
        if (err)
            res.redirect('tests?error');
        else {
            var testId = rows.insertId;
            connection.query("SELECT id, name FROM `questions` WHERE test_id = " + req.body.id, function(errs, rowss, fieldss) {
                if (errs)
                    res.redirect('tests?error');
                var quests = [];
                var insertQs = '';
                for (var i = 0; i < rowss.length; i++) {
                    var q = {
                        id: rowss[i].id,
                        name: rowss[i].name
                    };
                    insertQs += '("' + q.name + '", ' + testId + '),';
                    quests.push(q);
                }
                insertQs = insertQs.slice(0, -1);
                console.log(insertQs);
                console.log("INSERT INTO `questions` (name, test_id) VALUES " + insertQs);
                connection.query("INSERT INTO `questions` (name, test_id) VALUES " + insertQs, function(errq, rowsq, fieldsq) {
                    console.log(errq)
                    if (errq)
                        res.redirect('tests?error');
                    var questId = rowsq.insertId;
                    for (var i = 0; i < quests.length; i++) {
                        connection.query("INSERT INTO `options` (value, is_answer, question_id) SELECT value, is_answer, " + (questId + i) + " FROM `options` WHERE question_id = " + quests[i].id, function(erra, rowsa, fieldsa) {
                            if (erra)
                                res.redirect('tests?error');
                            var response = {
                                status: 200,
                                success: 'Cloned'
                            }
                            res.end(JSON.stringify(response));
                        });
                    }
                });
            });
        }
    });
});


app.get('/*', (req, res) => {
    if (!!user)
        res.redirect('/user');
    else
        res.redirect('/');
});

passport.serializeUser(function(user, done) {
    console.log('serializeUser');
    done(null, user.id);
});

var user;
passport.deserializeUser(function(id, done) {
    connection.query("select * from users where id = '" + id + "'", function(err, rows, fields) {
        if (err)
            throw err;
        user = { id: rows[0].id, name: rows[0].name, login: rows[0].login };
        session.login = user.login;
        session.id = user.id;
        return done(null, user);
    });
});


app.listen(3000, function() {
    console.log('listening on port', 3000);
});