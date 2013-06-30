var apiServer = 'http://api.doks.io';
var searchDelay = 100;

var search = document.getElementById('search');
var frame = document.getElementById('frame');
var sidebar = document.getElementById('sidebar');

var app = angular.module('d11n', []);
app.factory('typeFormatter', function() {
  var mapping = {
    'ClassMethod': 'M',
    'Constructor': 'M',
    'instm': 'M',
    'intfm': 'M'
  };
  return function(t) {
    if(mapping[t] != undefined) return mapping[t];
    return t.substring(0, 1).toUpperCase();
  };
});
app.directive('type', function(typeFormatter) {
  return {
    restrict: 'E',
    template: '<span class="type">{{ format(type) }}</span>',
    replace: true,
    scope: {
      type: '@title'
    },
    link: function(scope, element, attrs) {
      scope.format = typeFormatter;
    }
  }
});

function SearchController($scope, $location, $http, $timeout) {
  $scope.results = [];
  $scope.availableDocsets = [];
  $scope.docsets = ['HTML'];
  $scope.query = "";

  function loadFromLocation() {
    var paths = $location.path().substring(8).split('/');
    if(paths.length == 2) {
      $scope.docsets = paths[0].split('+');
      $scope.query = paths[1];
    }
  }
  loadFromLocation();
  $scope.$on('$locationChangeSuccess', loadFromLocation);

  var pending = null;
  var requestCounter = 0;
  $scope.searching = false;

  $scope.isSearch = function() {
    return $scope.query.length > 0 && $scope.query.charAt(0) != '!';
  }

  function onUpdate() {
    search.focus();
    var q = $scope.query;
    var path = 'search/'+$scope.docsets.join('+')+'/';
    $timeout.cancel(pending);
    sidebar.scrollTop = 0;

    if(q.length == 0) {
      $location.path(path);
      ++requestCounter;
      $scope.results = [];
      $scope.searching = false;
    }
    else if(q.charAt(0) == '!') {
      var term = q.substring(1);
      $scope.results = $scope.availableDocsets
        .filter(function(e) { return e.toUpperCase().indexOf(term.toUpperCase()) == 0})
        .map(function(e) { return {type: 'Language', name: e, uname: e.replace('_', ' ')}})
      $scope.selected = -1;
    }
    else if($scope.isSearch()) {
      $location.path(path+q);
      pending = $timeout(function() {
        $scope.doSearch(q);
      }, searchDelay);
      $scope.selected = -1;
    }
  }

  $scope.$watch('query', onUpdate);
  $scope.$watch('docsets', onUpdate);

  function unescape(input){
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
  }

  $scope.doSearch = function(query) {
    $scope.searching = true;
    var requestNum = ++requestCounter;
    var qs = $scope.docsets.map(function(elem) {return '&docset='+elem}).join()+'&q='+query;
    $http.jsonp(apiServer+'/search?callback=JSON_CALLBACK'+qs).success(function(data) {
      if(requestCounter == requestNum) {
        $scope.results = data.results;
        $scope.results.forEach(function(e) {e.uname = unescape(e.name)});
        $scope.searching = false;
      }
    });
  };

  $scope.selected = -1;

  $scope.onItemHover = function(index) {
    $scope.selected = index;
  };

  $scope.onItemClick = function(index) {
    if(index < 0) index = 0;
    if(index >= $scope.results.length) return;
    if($scope.isSearch()) {
      frame.src = $scope.results[index].path;
    }
    else {
      $scope.docsets = [$scope.results[index].name];
      $scope.query = "";
    }
    $scope.selected = -1;
  };

  function updateScroll() {
    if($scope.selected >= 0) {
      var selected = document.getElementById('results').children[$scope.selected];
      var topDiff = selected.offsetTop - sidebar.scrollTop;
      var bottomDiff = topDiff + selected.clientHeight - document.height;
      if(bottomDiff > 0) {
        sidebar.scrollTop += bottomDiff;
      }
      if(topDiff < 0) {
        sidebar.scrollTop += topDiff;
      }
    }
  }

  angular.element(search).bind('keydown', function(event) {
    if(event.keyCode == 40) {
      $scope.selected = ($scope.selected + 1) % $scope.results.length;
      updateScroll();
      event.preventDefault();
    }
    else if(event.keyCode == 38) {
      $scope.selected -= 1;
      updateScroll();
      if($scope.selected < 0) $scope.selected = $scope.results.length - 1;
      event.preventDefault();
    }
    else if(event.keyCode == 13) {
      $scope.onItemClick($scope.selected);
    }
    else if(event.keyCode == 27) {
      $scope.selected = -1;
    }
    $scope.$apply();
  });

  function caseInsensitiveCmp(a, b) {
    a = a.toUpperCase();
    b = b.toUpperCase();
    if(a < b) return -1;
    if(a > b) return 1;
    return 0;
  }

  $http.jsonp(apiServer+'/docs?callback=JSON_CALLBACK').success(function(data) {
    $scope.availableDocsets = data.sort(caseInsensitiveCmp);
  });
}
