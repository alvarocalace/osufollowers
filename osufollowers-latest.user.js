// ==UserScript==
// @name osu! followers
// @version 0.54
// @author Alvaro Daniel Calace
// @namespace https://github.com/alvarocalace/osufollowers
// @description Adds a new followed players section in your osu! profile
// @require http://code.jquery.com/jquery-latest.js
// @require http://timeago.yarp.com/jquery.timeago.js
// @include /osu.ppy.sh\/u\//
// @copyright 2015, Alvaro Daniel Calace
// @downloadURL https://raw.githubusercontent.com/alvarocalace/osufollowers/master/osufollowers-latest.user.js
// @grant GM_xmlhttpRequest
// @grant GM_addStyle
// ==/UserScript==

var u, URL_USER = "https://osu.ppy.sh/u/",
    URL_BEATMAP = "https://osu.ppy.sh/b/",
    URL_RANK = "https://osu.ppy.sh/p/pp?c=",
    URL_FLAG = "https://s.ppy.sh/images/flags/",
    URL_BEATMAP_THUMB = "https://b.ppy.sh/thumb/",
    URL_BEATMAP_PREVIEW = "https://b.ppy.sh/preview/",
    URL_RANK_LETTER = "//s.ppy.sh/images/",
    URL_AVATAR = "https://a.ppy.sh/",
    URL_BASE = "https://itoon-osufollower.rhcloud.com/",
    URL_HOW_TO_UPDATE = URL_BASE + "HowToUpdate",
    URL_API_SCORES = URL_BASE + "api/FollowedPlayersRecentTopScores",
    URL_API_PLAYERS = URL_BASE + "api/GetFollowedPlayers",
    URL_API_ADD = URL_BASE +
    "api/AddFollowedPlayer",
    URL_API_DELETE = URL_BASE + "api/DeleteFollowedPlayer",
    URL_CURRENT_VERSION = URL_BASE + "api/GetCurrentScriptVersion",
    URL_LOADING = URL_BASE + "img/loading.gif",
    URL_DELETE_ICON = URL_BASE + "img/delete.png",
    URL_ARROW_DOWN = URL_BASE + "img/arrowdown.png",
    URL_UPDATE_ICON = URL_BASE + "img/update.gif",
    index = 0,
    lock = 0,
    pollingRate = 10,
    defaultTimeout = 7500;
(function() {
    v() && waitForSelector(".profileStatHeader:eq(1)", init, defaultTimeout)
})();

function init(a) {
    a.before($("<div>").append(prepareGoodbyeDiv()));
}

function prepareGoodbyeDiv() {
	return $("<div style='border-top: 1px solid black; margin-top: 10px; padding: 10px;'>").text(
		"[osu!followers] " +
		"The server host doesn't exist anymore, and there's no much reason to go through the hassle of re-deploying everything. " +
		"Feel free to uninstall this extension, since it won't do much more than show this message from now on. " +
		"Thanks for using osu!followers during the last two years! " +
		"(perdon lucas me dio paja)");
}

function prepareTitleDiv() {
    return $("<div>").addClass("profileStatHeader").append($("<a>", {
        href: URL_BASE,
        target: "_blank"
    }).text("Followed Players"))
}

function prepareScoresDiv() {
    return $("<div>", {
        id: "scoresDiv"
    }).append($("<table>", {
        id: "scoresTable"
    }))
}

function prepareShowMeMoreDiv() {
    return $("<div>", {
        id: "showMeMoreDiv"
    }).append($("<a>", {
        href: "#"
    }).text("Show me more...").click(function(a) {
        a.preventDefault();
        isLocked() || appendBatch()
    })).append($("<img>", {
        id: "scoresLoadingIcon",
        "class": "icon",
        src: URL_LOADING
    }).hide())
}

function preparePlayersDiv() {
    return $("<div>", {
        id: "playersDiv"
    }).append(prepareExpandPlayersButton()).append(preparePlayersInput()).append(prepareUpdateButton())
}

function prepareExpandPlayersButton() {
    var a = $("<img>", {
        id: "expandPlayersButton",
        "class": "icon",
        src: URL_ARROW_DOWN
    });
    return $("<a>", {
        href: "#"
    }).click(function(b) {
        b.preventDefault();
        a.hasClass("rotated") ? a.removeClass("rotated") : a.addClass("rotated");
        b = $("#playersTableDiv");
        "none" === b.css("display") ? b.show() : b.hide()
    }).append(a)
}

function preparePlayersInput() {
    return $("<input>", {
        placeholder: "follow a new player!"
    }).on("keydown", function(a) {
        if (!isLocked()) {
            var b = $(this).val();
            13 === a.which && b && ($(this).val(""), processAdd(b))
        }
    })
}

function prepareUpdateButton() {
    return $("<a>", {
        href: "#"
    }).append($("<img>", {
        id: "updateIcon",
        src: URL_UPDATE_ICON
    })).click(function(a) {
        a.preventDefault();
        isLocked() || refreshScoresTable()
    })
}

function preparePlayersTableDiv() {
    return $("<div>", {
        id: "playersTableDiv"
    }).append($("<table>", {
        id: "playersTable",
        "class": "beatmapListing",
        cellspacing: 0
    }).append($("<thead>").append($("<tr>").append($("<th>").text("Rank")).append($("<th>").text("Player")).append($("<th>").text("Accuracy")).append($("<th>").text("Playcount")).append($("<th>").text("Performance")).append($("<th>").text("Delete"))))).append($("<img>", {
        id: "playersTableLoadingIcon",
        "class": "icon",
        src: URL_LOADING
    }).hide())
}

function prepareVersionWarningDiv(a, b) {
    return $("<div>", {
        id: "versionWarning"
    }).append($("<a>", {
        id: "hideVersionWarning",
        href: "#"
    }).click(function(a) {
        a.preventDefault();
        $("#versionWarning").remove()
    }).append($("<img>", {
        "class": "icon",
        src: URL_DELETE_ICON
    }))).append("Your script is outdated (current: " + a + " - latest: " + b + "). Click ").append($("<a>", {
        href: URL_HOW_TO_UPDATE,
        target: "_blank"
    }).text("here")).append(" to learn how to update it.").show(200)
}

function prepareBeatmapTooltip(a) {
    var b = $("<i>", {
        "class": "icon-play"
    });
    return $("<div>", {
        "class": "tooltipContainer"
    }).append($("<a>", {
        href: "#"
    }).click(function(d) {
        d.preventDefault();
        playBeatmapPreview(a, b.get(0))
    }).append($("<div>", {
        "class": "beatmapTooltip"
    }).css("background-image", "url(" + URL_BEATMAP_THUMB + a + ".jpg)").append(b))).hide()
}

function prepareAudioElement() {
    return $("<audio>", {
        id: "audioPreview"
    }).bind("ended", function() {
        pauseCurrentlyPlayingIcon()
    })
}

function preparePlayerTooltip(a) {
    return $("<img>", {
        "class": "playerTooltip",
        src: URL_AVATAR + a + "_0.jpg"
    }).hide()
}

function appendToScoresTable(a) {
    var b = prepareBeatmapTooltip(a.beatmap.setId),
        d = $("<a>", {
            href: URL_BEATMAP + a.beatmap.id,
            target: "_blank"
        }).text(a.beatmap.artist + " - " + a.beatmap.title + " [" + a.beatmap.version + "]").append(b).hover(function(a) {
            var g;
            a.clientY > d.offset().top - $(window).scrollTop() + d.height() / 3 ? (g = a.clientY, b.css("padding", "10px 0px 0px")) : (g = a.clientY - 70, b.css("padding", "0px 0px 10px"));
            showTooltip(b, a.clientX - 10, g)
        }, function(a) {
            hideTooltip(b)
        });
    $("#scoresTable").append($("<tr>").append($("<td>", {
        "class": "cell-timeago"
    }).append($("<time>", {
        "class": "timeago",
        datetime: a.date,
        title: formatDateForTitle(a.date)
    }).text($.timeago(a.date)))).append($("<td>").append($("<div>", {
        "class": "event epic1"
    }).append($("<img>", {
        src: URL_RANK_LETTER + a.rank + "_small.png"
    })).append(" ").append($("<a>", {
        href: URL_USER + a.username,
        target: "_blank",
        "class": "emphasize"
    }).text(a.username)).append(" got ").append($("<span>", {
        "class": "emphasize"
    }).text(a.pp + "pp")).append(" on ").append(d).append(" (" + a.accuracy + " - " + modsToString(a.mods) +
        ")"))))
}

function appendToPlayersTable(a) {
    var b = $("<td>", {
            href: "#",
            "class": "delete-button"
        }).click(function(b) {
            b.preventDefault();
            handleDeleteClick($(this), a.username)
        }).append($("<img>", {
            "class": "icon",
            src: URL_DELETE_ICON
        })),
        d = $("<a>", {
            target: "_blank",
            href: URL_USER + a.id
        }).text(a.username);
    if (a.id) {
        var e = preparePlayerTooltip(a.id);
        d.append(e).hover(function(a) {
            showTooltip(e, a.clientX + 20, a.clientY + 20)
        }, function(a) {
            hideTooltip(e)
        })
    }
    b = $("<tr>").append($("<td>", {
        "class": "emphasize"
    }).text(a.rank)).append($("<td>").append($("<a>", {
        href: URL_RANK +
            a.country,
        target: "_blank"
    }).append($("<img>", {
        src: URL_FLAG + a.country + ".gif"
    }))).append(" ").append(d)).append($("<td>").text(a.accuracy)).append($("<td>").text(a.playcount)).append($("<td>", {
        "class": "emphasize"
    }).text(a.pp)).append(b);
    refreshPlayerTableRowClasses(appendInOrder(b, a.rank))
}

function appendInOrder(a, b) {
    var d = $("#playersTable"),
        e = d.find("tbody > tr");
    if (!e.length) return d.append(a), 0;
    var g = parseInt(b.substring(1), 10);
    if (!g) return d.append(a), e.length;
    var f;
    for (f = 0; f < e.length; f++) {
        var h = parseInt(e[f].firstChild.textContent.substring(1), 10);
        if (!h || g < h) break
    }
    if (f < e.length) return e.eq(f).before(a), f;
    d.append(a);
    return e.length
}

function handleDeleteClick(a, b) {
    if (!isLocked() && confirm("Are you sure you want to stop following " + b + "?")) {
        var d = a.parent(),
            e = d.index();
        processDelete(b);
        d.remove();
        refreshPlayerTableRowClasses(e)
    }
}

function playBeatmapPreview(a, b) {
    var d = $("#audioPreview").get(0);
    d.paused || b !== pauseCurrentlyPlayingIcon() ? (b.className = "icon-pause", d.src = URL_BEATMAP_PREVIEW + a + ".mp3", d.play()) : d.pause()
}

function showMessage(a) {
    $("#messageSpan").remove();
    $("#playersDiv").append($("<span>", {
        id: "messageSpan"
    }).text(a).fadeIn(400).delay(4E3).fadeOut(400))
}

function refreshPlayerTableRowClasses(a) {
    for (var b = $("#playersTable > tbody  > tr"); a < b.length; a++) b[a].className = 1 === a % 2 ? "row2p" : "row1p"
}

function showTooltip(a, b, d) {
    a.stop().show(100).css("left", b + "px").css("top", d + "px")
}

function hideTooltip(a) {
    a.stop().hide(100)
}

function validateVersion() {
    createGetRequest(URL_CURRENT_VERSION, function(a) {
        if (200 === a.status) {
            var b = parseFloat(GM_info.script.version);
            a = parseFloat(a.responseText);
            b && a && a > b && $("#scoresDiv").before(prepareVersionWarningDiv(b, a))
        }
    })
}

function processDelete(a) {
    closeLock();
    var b = URL_API_DELETE,
        d = "username=" + encodeURIComponent(u) + "&player=" + encodeURIComponent(a),
        e = $("#playersTableLoadingIcon").show();
    createPostRequest(b, d, function(b) {
        200 === b.status ? (showMessage("You have unfollowed " + a + "."), refreshScoresTable()) : showMessage(b.responseText);
        e.hide();
        openLock()
    })
}

function processAdd(a) {
    closeLock();
    var b = URL_API_ADD;
    a = "username=" + encodeURIComponent(u) + "&player=" + encodeURIComponent(a);
    var d = $("#playersTableLoadingIcon").show();
    createPostRequest(b, a, function(a) {
        200 === a.status ? (a = $.parseJSON(a.responseText), appendToPlayersTable(a), showMessage("You are now following " + a.username + "."), refreshScoresTable()) : showMessage(a.responseText);
        d.hide();
        openLock()
    })
}

function appendBatch() {
    closeLock();
    var a = URL_API_SCORES + "?username=" + encodeURIComponent(u) + "&startingIndex=" + encodeURIComponent(index),
        b = $("#scoresLoadingIcon").show();
    createGetRequest(a, function(a) {
        if (200 === a.status) {
            a = $.parseJSON(a.responseText);
            for (var e = 0; e < a.length; e++) appendToScoresTable(a[e]), index++
        } else showMessage(a.responseText);
        a = $("#scoresDiv");
        a.stop().animate({
            scrollTop: a[0].scrollHeight
        }, 1E3);
        b.hide();
        openLock()
    })
}

function initPlayersTable() {
    closeLock();
    var a = [],
        b = URL_API_PLAYERS + "?username=" + encodeURIComponent(u),
        d = $("#playersTableLoadingIcon").show();
    createGetRequest(b, function(b) {
        if (200 === b.status)
            for (a = $.parseJSON(b.responseText), b = 0; b < a.length; b++) appendToPlayersTable(a[b]);
        else showMessage(b.responseText);
        d.hide();
        openLock()
    })
}

function refreshScoresTable() {
    $("#scoresTable").empty();
    index = 0;
    appendBatch()
}

function createGetRequest(a, b) {
    GM_xmlhttpRequest({
        method: "GET",
        url: a,
        onload: function(a) {
            b(a)
        }
    })
}

function createPostRequest(a, b, d) {
    GM_xmlhttpRequest({
        method: "POST",
        url: a,
        data: b,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        onload: function(a) {
            d(a)
        }
    })
}

function pauseCurrentlyPlayingIcon() {
    var a = $("#scoresTable").find(".icon-pause").first().get(0);
    a && (a.className = "icon-play");
    return a
}

function c(a) {
    return (document.cookie.match("(^|; )" + a + "=([^;]*)") || 0)[2]
}

function modsToString(a) {
    for (var b = "", d = 0; d < a.length; d++) b += a[d] + ", ";
    return b.substring(0, b.length - 2)
}

function waitForSelector(a, b, d) {
    var e = 0,
        g = setInterval(function() {
            var f = $(a);
            f.length ? (clearInterval(g), b(f)) : (e += pollingRate) >= d && clearInterval(g)
        }, pollingRate)
}

function formatDateForTitle(a) {
    var b = new Date(a),
        b = new Date(b.getTime() + 6E4 * b.getTimezoneOffset());
    a = b.getFullYear();
    var d = b.getMonth() + 1,
        e = b.getDate(),
        g = b.getHours(),
        f = b.getMinutes(),
        b = b.getSeconds();
    return a + "-" + pad(d) + "-" + pad(e) + " " + pad(g) + ":" + pad(f) + ":" + pad(b) + " UTC"
}

function pad(a) {
    return ("0" + a).slice(-2)
}

function v() {
    var a = $(".profile-username").first().text().trim();
    if (a) {
        if (u = c("last_login"))
            if (u = u.replace(/\+/g, " "), u === a) return !0;
        u = $(".content-infoline").last().find("a").first().text();
        if (u === a) return !0
    }
    return !1
}

function isLocked() {
    return lock
}

function closeLock() {
    lock--
}

function openLock() {
    lock++
}

function initStyle() {
    GM_addStyle("#versionWarning,.emphasize{font-weight:700}.beatmapTooltip,.delete-button{text-align:center}.playerTooltip,.tooltipContainer{position:fixed}#scoresDiv{overflow-y:auto;max-height:160px}#expandPlayersButton{padding-right:3px}#updateIcon{padding-left:3px;width:14px;height:10px}#playersDiv{padding-top:10px}#playersTableDiv,#showMeMoreDiv{padding-top:5px}#messageSpan{padding-left:10px;color:#848484}#versionWarning{background-color:#FCC;box-shadow:1px 1px 1px 1px #8E8EA8;height:20px;margin-bottom:5px;line-height:20px;padding-left:10px;display:none}#hideVersionWarning{float:right;padding:5px}.icon{height:10px;width:10px}.cell-timeago{width:20%}.rotated{transform:rotate(-90deg)}.beatmapTooltip{width:80px;height:60px;transition:opacity .3s;opacity:.6;box-shadow:2px 2px 4px #000}.beatmapTooltip:hover{opacity:1}.beatmapTooltip i{line-height:60px;text-decoration:none;font-size:400%;color:rgba(255,255,255,.9);text-shadow:0 0 5px #000}.playerTooltip{opacity:.8;height:100px;width:100px;box-shadow:2px 2px 4px #000}")
};
