// Copyright or something.
'use strict';

function CodesearchSearcher(query) {
  Searcher.call(this, query);
}
inherits(CodesearchSearcher, Searcher);

// JAMES we need an official suggestions endpoint.
//
// The production source.chromium.org does a POST to:
// https://grimoireoss-pa.clients6.google.com/batch?%24ct=multipart%2Fmixed%3B%20boundary%3Dbatch516842768408498906
// with
// {"queryString":"hello","suggestOptions":{"maxSuggestions":7,"pathPrefix":"","repositoryScope":{"domain":"source.chromium.org","visibility":"PUBLIC_ONLY"},"savedQuery":""}}
CodesearchSearcher.prototype.getSuggestionsURL = function() {
  return [
    'https://source.chromium.org/codesearch/json?',
    'suggest_request=b&',
    'query=', encodeURI(this.query), '+package%3Achromium&',
    'query_cursor_position=' + this.query.length, '&',
    'suggest_request=e'
    // Note: when invoking from cs.chromium.org there is also a "sid"
    // parameter, but I don't know how to generate it, nor does it appear
    // to matter if it's left out.
  ].join('');
};

CodesearchSearcher.prototype.getSuggestions = function(response) {
  var suggestions = null;
  try {
    var responseJson = JSON.parse(response);
    suggestions = responseJson.suggest_response[0].suggestion;
    if (suggestions == null) {
      // No suggestions.
      return [];
    }
  } catch (e) {
    console.error('Invalid response: ', response);
    return [];
  }

  suggestions.sort(function(s1, s2) {
    return s1.score < s2.score;
  });

  window.cs = suggestions.map(function(suggest) {
    var has_line = suggest.goto_line && suggest.goto_line > 1;

    // Construct the link that has been suggested.
    var href = [
      'https://source.chromium.org/', suggest.goto_package_id, '/',
      suggest.goto_path, '?', 'q=', encodeURI(this.query), '&',
      'sq=package:chromium&', has_line ? ('l=' + suggest.goto_line) : '',
    ].join('');

    // Simpler to always have a match_start/match_end.
    if (!('match_start' in suggest))
      suggest.match_start = 0;
    if (!('match_end' in suggest))
      suggest.match_end = suggest.title.length;

    return {
      content: href,
      description: [
        // Title, with the matching text in bold.
        suggest.title.slice(0, suggest.match_start),
        '<match>',
        suggest.title.slice(suggest.match_start, suggest.match_end),
        '</match>',
        suggest.title.slice(suggest.match_end),
        // Path for the query, complete with :42 for line 42, if applicable.
        // The "url" is a bit of a lie, but it looks nice.
        ' <url>',
        suggest.goto_path,
        has_line ? (':' + suggest.goto_line) : '',
        '</url>'
      ].join('')
    };
  }.bind(this));
  return window.cs;
};

// A search for 'hello' generates:
// https://source.chromium.org/search?q=hello&sq=&ss=chromium
CodesearchSearcher.prototype.getSearchURL = function() {
  return [
    'https://source.chromium.org/search/', '?q=', encodeURI(this.query),
    // Scoped query?
    '&sq=',
    // Session source?
    '&ss=chromium'
  ].join('');
};
