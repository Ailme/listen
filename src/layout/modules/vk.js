VK = (function () {
    "use strict";

    var BASE_URL = "https://api.vk.com/method/";

    function makeAPIRequest(method, options, onload, onerror) {
        if (typeof options === "function") {
            onerror = onload;
            onload = options;
            options = {};
        }

        options.access_token = Settings.get("vkToken");
        options.v = "5.0";
        options.count = options.count || 300;
        options.offset = options.offset || 0;

        loadResource(BASE_URL + method + ".xml", {
            responseType: "xml",
            data: options,
            onload: function (xml) {
                onload(xml);
                // http://d.pr/i/SubI - error node
            },
            onerror: onerror
        }, this);
    }

    function xmlToArray(xml, options) {
        var output = [];
        var cloudTitle = chrome.i18n.getMessage("cloudTitle");
        var downloadTitle = chrome.i18n.getMessage("downloadTitle");
        var addTitle = chrome.i18n.getMessage("addToMyAudio");
        var countNode = xml.querySelector("count");
        var count = countNode ? parseInt(countNode.textContent, 10) : 0;

        [].forEach.call(xml.querySelectorAll("audio"), function (audio) {
            var audioIdNode = audio.querySelector("id");
            if (!audioIdNode)
                return;

            var audioId = audioIdNode.textContent;
            var duration = audio.querySelector("duration").textContent;

            output.push({
                id: audioId,
                ownerId: audio.querySelector("owner_id").textContent,
                pending: (SyncFS.downloadedIds.indexOf(audioId) !== -1 || !options.syncfs),
                noadd: options.current ? true : false,
                source: audio.querySelector("url").textContent,
                artist: audio.querySelector("artist").textContent,
                song: audio.querySelector("title").textContent,
                originalDuration: duration,
                duration: Math.floor(duration / 60) + ":" + strpad(duration % 60),
                cloudTitle: cloudTitle,
                downloadTitle: downloadTitle,
                addTitle: addTitle
            });
        });

        return {
            count: output.length ? count : 0,
            showDownload: Settings.get("showDownloadButtons"),
            songs: output
        };
    }


    return {
        searchMusic: function VK_searchMusic(query, params, callback) {
            params = copyOwnProperties(params, {
                q: query,
                auto_complete: 1,
                lyrics: 0,
                performer_only: 0,
                sort: 2
            });

            parallel({
                syncfs: function (callback) {
                    SyncFS.isWorking(callback);
                },
                vkdata: function (callback) {
                    makeAPIRequest("audio.search", params, callback);
                }
            }, function (results) {
                callback(xmlToArray(results.vkdata, {syncfs: results.syncfs}));
            });
        },

        searchMusicByArtist: function VK_searchMusic(query, params, callback) {
            params = copyOwnProperties(params, {
                q: query,
                auto_complete: 0,
                lyrics: 0,
                performer_only: 1,
                sort: 2
            });

            parallel({
                syncfs: function (callback) {
                    SyncFS.isWorking(callback);
                },
                vkdata: function (callback) {
                    makeAPIRequest("audio.search", params, callback);
                }
            }, function (results) {
                callback(xmlToArray(results.vkdata, {syncfs: results.syncfs}));
            });
        },

        getCurrent: function VK_getCurrent(offset, callback) {
            parallel({
                syncfs: function (callback) {
                    SyncFS.isWorking(callback);
                },
                vkdata: function (callback) {
                    makeAPIRequest("audio.get", {offset: offset}, callback);
                }
            }, function (results) {
                var output = xmlToArray(results.vkdata, {
                    syncfs: results.syncfs,
                    current: true
                });

                callback(output);
            });
        },

        getAlbums: function VK_getAlbums(callback) {
            makeAPIRequest("audio.getAlbums", {count: 1}, function (xml) {
                var countNode = xml.querySelector("count");
                var output = countNode ? countNode.textContent : null;

                callback(output);
            }, function (err) {
                callback(null);
            });
        },

        add: function VK_add(ownerId, audioId, callback) {
            makeAPIRequest("audio.add", {
                audio_id: audioId,
                owner_id: ownerId
            }, function (xml) {
                var responseNode = xml.querySelector("response");
                var output = (responseNode && responseNode.textContent) ? responseNode.textContent : null;

                callback(output);
            }, function (err) {
                callback(null);
            });
        }
    };
})();
