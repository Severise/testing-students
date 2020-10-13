var k = 2;
$(document).ready(function() {

    $('#menu span:first-child').click(openForm);
    $('#menu span:nth-child(2)').click(closeForm);
    $('.addOption').click(addOption);
    $('.changeType').click(change);
    $('#tabs ul li:last-child').click(addQuest);
    $('#tabs li:nth-last-child(2)').click(deleteQuest);
    $('#tabs ul li:not(:last-child, :nth-last-child(2))').click(activate);
    $('#nav ul li').click(scroll);

    $('.delete').click(openForm);
    $('.open').click(openTest);
    $('.lock').click(closeTest);
    $('.clone').click(openForm);
    $('#signForm button[type=button]').click(closeForm);
    $('#tabs li:nth-last-child(3)').click();
    var f_sl = 1;
    var f_nm = 1;
    $("thead th").click(function() {
        f_sl *= -1;
        var n = $(this).prevAll().length;
        sortTable(f_sl, n);
    });

});

function addOption() {
    k++;
    var par = $(this).parent().attr('id');

    if ($('#' + par + ' .left input').length > $('#' + par + ' .right input').length)
        $('#' + par + ' .right').append('<input class="option" type="text" autocomplete="off"/><input type="checkbox" />');
    else
        $('#' + par + ' .left').append('<input class="option" type="text" autocomplete="off"/><input type="checkbox" />');
}

function change() {
    var par = $(this).parent().attr('id');
    if ($('#' + par + ' .opt').css('display') == 'none') {
        while ($('#' + par + ' .opt .right input[type=text]').length > 2) {
            $('#' + par + ' .opt .right input[type=text]').last().remove();
            $('#' + par + ' .opt .right input[type=checkbox]').last().remove();
        }
        while ($('#' + par + ' .opt .left input[type=text]').length > 2) {
            $('#' + par + ' .opt .left input[type=text]').last().remove();
            $('#' + par + ' .opt .left input[type=checkbox]').last().remove();
        }
        $('#' + par + ' .opt').css('display', 'block');
        $('#' + par + ' .ans').css('display', 'none');
        $('#' + par + ' .answer').remove();
    } else {
        $('#' + par + ' .opt').css('display', 'none');
        $('#' + par + ' .ans').append('<input class="answer" type="text" autocomplete="off" />');
        $('#' + par + ' .ans').css('display', 'block');
    }
    $('#' + par + ' .option').val('');
    $('#' + par + ' .answer').val('');
    $('#' + par + ' input[type=checkbox]').prop("checked", false);
}

function addQuest() {
    var n = parseInt($('#tabs ul li:first-child').text()) + 1;
    if (!n)
        n = 1;
    var temp = '<div id="q' + n + '" class="question active">' +
        '<label>Вопрос ' + n + '</label>' +
        '<input name="question" type="text" autocomplete="off" required/>' +
        '<div class="opt">' +
        '<label>Варианты</label>' +
        '<div class="left">' +
        '<input class="option" type="text" autocomplete="off" /><input type="checkbox" />' +
        '</div>' +
        '<div class="right">' +
        '<input class="option" type="text" autocomplete="off" /><input type="checkbox" />' +
        '</div><br>' +
        '</div>' +
        '<div class="ans">' +
        '<label>Ответ</label>' +
        // '<input class="answer" type="text" autocomplete="off" required/>' +
        '</div>' +
        '<button class="addOption" type="button">Добавить вариант</button><button class="changeType" type="button">Изменить тип ответа</button>' +
        '</div>';

    $('#tabs ul').prepend('<li>' + n + '</li>');
    $('#ques').append(temp);
    $('#q' + n + ' .addOption').click(addOption);
    $('#q' + n + ' .changeType').click(change);
    $('#tabs ul li:first-child').click(activate);
    $('#tabs ul li:first-child').click();
}

function deleteQuest() {
    var n = parseInt($('li.active').text()) - 1;
    $('.question.active').remove();
    $('li.active').remove();
    $('#tabs li:contains(' + n + ')').click();
    // reNumber();
    //quest numbers
}


// function reNumber() {
//     var n = parseInt($('#tabs li:first-child').text());
//     var t = 1;
//     for (var i = 1; i < n; i++) {
//         t=1;
//         if (!$('#tabs li:contains(' + i + ')').text()) {
//             console.log(i);
//             t = i + 1;
//             while (!!$('#tabs li:contains(' + t + ')').text()) {
//                 console.log($('#tabs li:contains(' + t + ')').text());
//                 $('#tabs li:contains(' + t + ')').text(i);
//                 $('#q' + t + '>label:first-child').text('Вопрос ' + i);
//                 $('#q' + t).attr('id', 'q' + i);
//             }
//         }
//     }
// }

function activate() {
    $('#tabs li').removeClass('active');
    $(this).addClass('active');
    var n = parseInt($(this).text());
    $('.question').removeClass('active');
    $('#q' + n).addClass('active');
}

function send() {
    var last = $('.answer').length > $('.option').length ? $('.answer').length : $('.option').length;
    for (var i = 0; i < last; i++) {
        if (i < $('.option').length && $('.option').eq(i).val() == '') {
            $('.option').eq(i).remove();
            $('input[type=checkbox]').eq(i).remove();
            i--;
        }
        if (i < $('.answer').length && $('.answer').eq(i).val() == '') {
            $('.answer').eq(i).remove();
            i--;
        }
    }
    var qs = [];
    var max = 0;
    if (window.location.href.indexOf('edit') > -1)
        var url = 'edit';
    else var url = 'create'
    $('.question').each(function() {
        var opts = [];
        $(this).find('.option, .answer').each(function() {
            var check = $(this).next().prop('checked') ? 1 : 0;
            if ($(this).attr('class') == 'answer')
                check = 1;
            max += check;
            // var aid = $(this).attr('class');
            // aid = aid.substring(aid.indexOf('id')).substring(2);
            var opt = {
                // id: parseInt(aid),
                value: $(this).val(),
                checked: check
            };
            opts.push(opt);
        });
        // var qid = $(this).find('[name=question]').attr('class');
        // qid = qid.substring(qid.indexOf('id')).substring(2);
        var q = {
            // id: parseInt(qid),
            name: $(this).find('[name=question]').val(),
            answers: opts
        };
        qs.push(q);
    });
    var id = $('[name=test]').attr('class');
    if (id)
        id = id.substring(id.indexOf('id')).substring(2);
    var test = {
        id: parseInt(id),
        name: $('[name=test]').val(),
        max: max,
        time: $('[name=time]').val(),
        questions: qs
    };
    console.log(test);
    $.ajax({
        type: "POST",
        url: '/' + url,
        data: JSON.stringify(test),
        success: function(res) {
            console.log('from server:', res);
            window.location.href = '/user?' + url + '=true';
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
        },
        contentType: "application/json",
        dataType: 'json'
    });
}


function scroll() {
    var offset = 100;
    var n = parseInt($(this).text()) - 1;
    console.log(n);
    $('html, body').animate({
        scrollTop: $('.quest').eq(n).offset().top - offset
    }, 500);
}

function openForm(event) {
    $('#signForm').css('display', 'block');
    $('#menu span:first-child').css('display', 'none');
    $('#menu span:nth-child(2)').css('display', 'inline');
    $('#signForm span').text($(this).parent().parent().find('h2').text());
    $('#signForm [name=id]').val($(this).parent().parent().prop('id'));
}

function closeForm(event) {
    $('#signForm').css('display', 'none');
    $('#menu span:first-child').css('display', 'inline');
    $('#menu span:nth-child(2)').css('display', 'none');
}

function clone() {
    console.log(this);
    if (!$('#signForm span').text()) {
        closeForm();
        return;
    }
    data = { id: $('#signForm [name=id]').val() };

    var url = 'clone';
    $.ajax({
        type: "POST",
        url: url,
        data: data,
        success: function(res) {
            console.log('from server:', res);
        },
        error: function() {
            console.error("ERROR");
        },
        dataType: 'json'
    });
    closeForm();
}

function deleteTest() {
    if (!$('#signForm span').text()) {
        closeForm();
        return;
    }
    data = { id: parseInt($('#signForm [name=id]').val()) };
    console.log(data);
    var url = 'delete';
    $.ajax({
        type: "POST",
        url: url,
        data: data,
        success: function(res) {
            $('#' + data.id).remove();
            console.log('from server:', res);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.log(jqXHR);
            console.log(textStatus);
            console.log(errorThrown);
        },
        dataType: 'json'
    }).done(function(data) {
        console.log(data);
    });
    closeForm();
}

function openTest() {
    data = {
        id: $(this).parent().parent().prop('id'),
        state: 1
    };
    var a = $(this);

    var url = 'openClose';
    $.ajax({
        type: "POST",
        url: url,
        data: data,
        success: function(res) {
            console.log('from server:', res);
        },
        error: function(err) {
            console.log(err);
        },
        dataType: 'json'
    }).done(function(data) {
        if (data.status == 200) {
            a.replaceWith('<a class="lock"><i class="fas fa-lock" title="lock" aria-hidden="true"></i><span class="sr-only">lock</span></a>');
            $('.lock').click(closeTest);
        }
    });
    closeForm();
}

function closeTest() {
    data = {
        id: $(this).parent().parent().prop('id'),
        state: 0
    };
    var a = $(this);
    var url = 'openClose';
    $.ajax({
        type: "POST",
        url: url,
        data: data,
        success: function(res) {
            console.log('from server:', res);
        },
        error: function(err) {
            console.log(err);
        },
        dataType: 'json'
    }).done(function(data) {
        if (data.status == 200) {
            a.replaceWith('<a class="open"><i class="fas fa-lock-open" title="open" aria-hidden="true"> </i><span class="sr-only">open</span></a>');
            $('.open').click(openTest);
        }
    });
    closeForm();
}

function sortTable(f, n) {
    var rows = $('tbody  tr').get();
    rows.sort(function(a, b) {
        var A = getVal(a);
        var B = getVal(b);

        if (A < B) {
            return -1 * f;
        }
        if (A > B) {
            return 1 * f;
        }
        return 0;
    });

    function getVal(elm) {
        var v = $(elm).children('td').eq(n).text().toUpperCase();
        if ($.isNumeric(v)) {
            v = parseInt(v, 10);
        }
        return v;
    }

    $.each(rows, function(index, row) {
        $('table').children('tbody').append(row);
    });
}