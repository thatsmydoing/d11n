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
app.factory('docsetResolver', function() {
  var parents = {
    'CakePHP': ['PHP'],
    'Yii': ['PHP'],
    'CodeIgniter': ['PHP'],
    'Zend Framework': ['PHP'],
    'Play_Scala': ['Scala'],
    'Play_Java': ['Java'],
    'Ruby on Rails': ['Ruby'],
    'Django': ['Python 2'],
    'Compass': ['Sass']
  };

  var groups = {
    'Web': ['HTML', 'CSS', 'JavaScript']
  };

  function resolve(docset, withParent) {
    if(groups[docset] != undefined) {
      return groups[docset];
    }
    else if(withParent && parents[docset] != undefined) {
      return [docset].concat(parents[docset]);
    }
    else {
      return [docset];
    }
  }

  return {
    resolve: resolve,
    parents: parents,
    groups: groups
  };
})
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

function SearchController($scope, $location, $http, $timeout, docsetResolver) {
  $scope.results = [];
  $scope.availableDocsets = [];
  $scope.currentDocset = 'Web';
  $scope.query = "";
  $scope.withParent = false;

  function watchSet(field) {
    $scope.$watch(field, function(v) {
      localStorage.setItem(field, v);
    });
  }

  function loadFromStorage() {
    if(localStorage.getItem('currentDocset') == null) {
      $scope.query = '!';
    }
    else {
      $scope.currentDocset = localStorage.getItem('currentDocset');
      $scope.withParent = localStorage.getItem('withParent');
    }
  }

  function loadFromLocation() {
    if($scope.availableDocsets.length == 0) return false;
    var paths = $location.path().substring(8).split('/');
    if(paths.length == 2) {
      $scope.withParent = false;
      if(paths[0].charAt(0) == '~') {
        $scope.withParent = true;
        paths[0] = paths[0].substring(1);
      }
      $scope.currentDocset = paths[0];
      $scope.query = paths[1];
      return true;
    }
    return false;
  }

  $scope.$on('$locationChangeSuccess', loadFromLocation);

  var pending = null;
  var requestCounter = 0;
  $scope.searching = false;

  $scope.noResults = function() {
    return !$scope.searching && currentMode == articleSelect && $scope.results.length == 0;
  }

  function path() {
    var hasTilde = docsetResolver.parents[$scope.currentDocset] != undefined && $scope.withParent;
    return 'search/'+(hasTilde ? '~' : '')+$scope.currentDocset+'/';
  }

  var emptySelect = {
    onUpdate: function(q) {
      $location.path(path());
      ++requestCounter;
      $scope.results = [];
    },
    onItemClick: function() {},
    onDetach: function() {}
  }

  var languageSelect = {
    onUpdate: function(q) {
      var term = q.substring(1);
      $scope.results = $scope.availableDocsets
        .filter(function(e) { return e.toUpperCase().indexOf(term.toUpperCase()) == 0})
        .map(function(e) { return {type: 'Language', name: e, uname: e.replace('_', ' ')}})
    },
    onItemClick: function(index) {
      $scope.currentDocset = $scope.results[index].name;
      $scope.query = "";
    },
    onDetach: function() {}
  };

  var articleSelect = {
    onUpdate: function(q) {
      $scope.searching = true;
      $location.path(path()+q);
      $timeout.cancel(pending);
      pending = $timeout(function() {
        $scope.doSearch(q);
      }, searchDelay);
    },
    onItemClick: function(index) {
      frame.src = $scope.results[index].path;
    },
    onDetach: function() {
      $scope.searching = false;
      $timeout.cancel(pending);
    }
  };

  var currentMode = emptySelect;

  function switchMode(mode) {
    if(mode != currentMode) {
      currentMode.onDetach();
      currentMode = mode;
    }
  }

  function onUpdate() {
    search.focus();
    sidebar.scrollTop = 0;
    var q = $scope.query;
    if(q.length == 0) {
      switchMode(emptySelect);
    }
    else if(q.charAt(0) == '!') {
      switchMode(languageSelect);
    }
    else {
      switchMode(articleSelect);
    }
    currentMode.onUpdate(q);
    $scope.resetSelection();
  }

  function unescape(input){
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
  }

  $scope.doSearch = function(query) {
    var requestNum = ++requestCounter;
    var qs = docsetResolver.resolve($scope.currentDocset, $scope.withParent).map(function(elem) {return '&docset='+elem}).join('')+'&q='+query;
    $http.jsonp(apiServer+'/search?callback=JSON_CALLBACK'+qs).success(function(data) {
      if(requestCounter == requestNum) {
        $scope.results = data.results;
        $scope.results.forEach(function(e) {e.uname = unescape(e.name)});
        $scope.searching = false;
      }
    });
  };

  $scope.resetSelection = function() {
    $scope.selected = -1;
  }

  $scope.onItemHover = function(index) {
    $scope.selected = index;
  };

  $scope.onItemClick = function(index) {
    if(index < 0) index = 0;
    if(index >= $scope.results.length) return;
    currentMode.onItemClick(index);
    $scope.resetSelection();
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
    if((event.keyCode == 40) || (event.ctrlKey && event.keyCode == 74)) {
      $scope.selected = ($scope.selected + 1) % $scope.results.length;
      updateScroll();
      event.preventDefault();
    }
    else if((event.keyCode == 38) || (event.ctrlKey && event.keyCode == 75)) {
      $scope.selected -= 1;
      if($scope.selected < 0) $scope.selected = $scope.results.length - 1;
      updateScroll();
      event.preventDefault();
    }
    else if(event.keyCode == 13) {
      $scope.onItemClick($scope.selected);
    }
    else if(event.keyCode == 27) {
      $scope.resetSelection();
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
    angular.forEach(docsetResolver.groups, function(value, key) {
      data.push(key);
    })
    $scope.availableDocsets = data.sort(caseInsensitiveCmp);

    if(!loadFromLocation()) {
      loadFromStorage();
    }

    $scope.$watch('query', onUpdate);
    $scope.$watch('currentDocset', onUpdate);
    $scope.$watch('withParent', onUpdate);
    watchSet('currentDocset');
    watchSet('withParent');
  });

  $scope.parts = function() {
    if(docsetResolver.groups[$scope.currentDocset] != undefined) {
      return '('+docsetResolver.groups[$scope.currentDocset].join(', ')+')'
    }
    return "";
  }

  $scope.parents = function() {
    if(docsetResolver.parents[$scope.currentDocset] != undefined) {
      return docsetResolver.parents[$scope.currentDocset].join(',');
    }
    return "";
  }
}
