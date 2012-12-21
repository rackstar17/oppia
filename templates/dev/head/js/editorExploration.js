// Copyright 2012 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview Angular controllers for elements on an editor's question page.
 *
 * @author sll@google.com (Sean Lip)
 */

var END_DEST = '-1';
var QN_DEST_PREFIX = 'q-';
// TODO(sll): Internationalize these.
var END_STRING = 'END';
var NEW_QUESTION_STRING = 'New question';
var GUI_EDITOR_URL = '/gui'
var YAML_EDITOR_URL = '/text'

// TODO(sll): Move all strings to the top of the file, particularly
// warning messages and activeInputData.name.
// TODO(sll): console.log is not supported in IE. Fix before launch.
// TODO(sll): CSS3 selectors of the form [..] aren't supported in all browsers.

var DEFAULT_CATEGORY_NAME = 'Default';
var DEFAULT_DESTS = {
    'finite': [],
    'none': [{'category': '', 'dest': END_DEST, 'text': ''}],
    'numeric': [{'category': DEFAULT_CATEGORY_NAME, 'dest': END_DEST, 'text': ''}],
    'set': [{'category': DEFAULT_CATEGORY_NAME, 'dest': END_DEST, 'text': ''}],
    'text': [{'category': DEFAULT_CATEGORY_NAME, 'dest': END_DEST, 'text': ''}]
};
// The following list maps input views to classifiers.
var CLASSIFIER_MAPPING = {
    'int': 'numeric',
    'multiple_choice': 'finite',
    'none': 'none',
    'set': 'set',
    'text': 'text'
};
var HUMAN_READABLE_INPUT_TYPE_MAPPING = {
    'int': 'Numeric',
    'multiple_choice': 'Multiple choice',
    'none': 'none',
    'set': 'Set',
    'text': 'Free text'
};

oppia.config(['$routeProvider', function($routeProvider) {
  $routeProvider.
      when(YAML_EDITOR_URL,
           {templateUrl: '/templates/yaml',
            controller: YamlEditor}).
      when(YAML_EDITOR_URL + '/:stateId',
           {templateUrl: '/templates/yaml',
            controller: YamlEditor}).
      when(GUI_EDITOR_URL,
           {templateUrl: '/templates/gui',
            controller: GuiEditor}).
      when(GUI_EDITOR_URL + '/:stateId',
           {templateUrl: '/templates/gui',
            controller: GuiEditor}).
      otherwise({redirectTo: GUI_EDITOR_URL});
}]);


oppia.factory('explorationDataFactory', function($rootScope, $http, warningsData) {
  // Put exploration variables here.
  var explorationData = {};

  // The pathname should be: .../create/{exploration_id}[/{state_id}]
  var pathnameArray = window.location.pathname.split('/');
  var explorationId = pathnameArray[2];
  var explorationUrl = '/create/' + explorationId;

  explorationData.getData = function() {
    var obj = this;
    console.log('Getting exploration data');
    $http.get(explorationUrl + '/data').success(function(data) {
      obj.data = data;
      obj.states = data.state_list;
      obj.initState = data.init_state_id;

      obj.broadcastExploration();
    }).error(function(data) {
      warningsData.addWarning('Server error: ' + data.error);
    });
  };

  explorationData.broadcastExploration = function() {
    $rootScope.$broadcast('explorationData');
  }

  return explorationData;
});


oppia.factory('stateDataFactory', function($rootScope, $http, warningsData) {
  // Put state variables here.
  var stateData = {};

  // The pathname should be: .../create/{exploration_id}[/{state_id}]
  var pathnameArray = window.location.pathname.split('/');
  var explorationId = pathnameArray[2];
  var explorationUrl = '/create/' + explorationId;

  /**
   * Gets the data for a particular state.
   * @param {string} stateId The id of the state to get the data for.
   */
  // TODO(sll): Get this from the frontend if is already there.
  stateData.getData = function(stateId) {
    var obj = this;
    console.log('Getting state data');
    $http.post(
        explorationUrl + '/' + stateId, '',
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).
            success(function(data) {
              obj.data = data;
              console.log(data);
              obj.stateName = data.stateName;
              obj.stateContent = data.stateContent;
              obj.inputType = data.inputType;
              obj.classifier = data.classifier;
              obj.yaml = data.yaml;

              obj.broadcastState();
            }).
            error(function(data) {
              warningsData.addWarning('Server error: ' + data.error);
            });
  };

  stateData.broadcastState = function() {
    $rootScope.$broadcast('stateData');
  }

  return stateData;
});


// Filter that truncates long descriptors.
// TODO(sll): Strip out HTML tags before truncating.
oppia.filter('truncate', function() {
  return function(input, length, suffix) {
    if (!input)
      return '';
    if (isNaN(length))
      length = 50;
    if (suffix === undefined)
      suffix = '...';
    if (input.length <= length || input.length - suffix.length <= length)
      return input;
    else
      return String(input).substring(0, length - suffix.length) + suffix;
  }
});

// Receive events from the iframed widget repository.
oppia.run(function($rootScope) {
  window.addEventListener('message', function(event) {
    console.log(event);
    $rootScope.$broadcast('message', event);
  });
});

oppia.directive('imageUpload', function($exceptionHandler) {
  return {
    compile: function(tplElm, tplAttr) {
      return function(scope, elm, attr) {
        var input = angular.element(elm[0]);

        // evaluate the expression when file changed (user selects a file)
        input.bind('change', function() {
          try {
            scope.$eval(attr.openFiles, {$files: input[0].files});
            scope.setActiveImage(input[0].files[0]);
          } catch (e) {
            $exceptionHandler(e);
          }
        });
      };
    }
  };
});

oppia.directive('unfocusstateContent', function(activeInputData) {
  return {
    restrict: 'A',
    link: function(scope, element, attribs) {
      element[0].focus();
      element.bind('blur', function() {
        scope.stateContent[scope.$index] = scope.item;
        scope.$apply(attribs['unfocusstateContent']);
        scope.saveStateChange('stateContent');
        activeInputData.clear();
      });
    }
  };
});

// Makes the palette icons draggable.
oppia.directive('oppiaPaletteIcon', function($compile, activeInputData) {
  return {
    restrict: 'C',
    link: function(scope, element, attrs) {
      $(element).draggable({
        containment: 'window',
        helper: 'clone',
        revert: 'invalid',
        start: function(event, ui) {
          activeInputData.clear();
          scope.$apply();
        },
        zIndex: 3000
      });
    }
  };
});

// Allows palette icons to be dropped.
oppia.directive('oppiaPaletteDroppable', function($compile, warningsData) {
  return {
    restrict: 'C',
    link: function(scope, element, attrs) {
      $(element).droppable({
        accept: '.oppia-palette-icon',
        activeClass: 'oppia-droppable-active',
        drop: function(event, ui) {
          if ($(ui.draggable).hasClass('oppia-palette-text')) {
            activeInputData.name = 'stateContent.' + scope.stateContent.length;
            scope.stateContent.push({type: 'text', value: ''});
          } else if ($(ui.draggable).hasClass('oppia-palette-image')) {
            scope.stateContent.push({type: 'image', value: ''});
          } else if ($(ui.draggable).hasClass('oppia-palette-video')) {
            scope.stateContent.push({type: 'video', value: ''});
          } else if ($(ui.draggable).hasClass('oppia-palette-widget')) {
            scope.stateContent.push({type: 'widget', value: ''});
          } else {
            warningsData.addWarning('Unknown palette icon.');
            return;
          }
          scope.$apply();
        }
      });
    }
  };
});

// Allows stateContent items to be trashed.
oppia.directive('oppiaItemDroppable', function($compile) {
  return {
    restrict: 'C',
    link: function(scope, element, attrs) {
      $(element).droppable({
        accept: '.oppia-state-text-item',
        hoverClass: 'oppia-droppable-trash-active',
        drop: function(event, ui) {
          for (var i = 0; i < scope.stateContent.length; ++i) {
            if ($(ui.draggable).hasClass('item-' + i)) {
              // TODO(sll): Using just scope.stateContent.splice(i, 1) doesn't
              // work, because the other objects in the array get randomly
              // arranged. Find out why, or refactor the following into a
              // different splice() method and use that throughout.
              var tempstateContent = [];
              for (var j = 0; j < scope.stateContent.length; ++j) {
                if (i != j) {
                  tempstateContent.push(scope.stateContent[j]);
                }
              }
              scope.$parent.stateContent = tempstateContent;
              return;
            }
          }
        },
        tolerance: 'touch'
      });
    }
  };
});

// Makes the corresponding elements sortable.
// TODO(sll): This directive doesn't actually update the underlying array,
// so ui-sortable still needs to be used. Try and fix this.
oppia.directive('sortable', function($compile) {
  return {
    restrict: 'C',
    link: function(scope, element, attrs) {
      $(element).sortable({
        scroll: false,
        stop: function(event, ui) {
          if ($(ui.item).hasClass('oppia-state-text-item')) {
            // This prevents a collision with the itemDroppable trashing.
            for (var i = 0; i < scope.stateContent.length; ++i) {
              if (scope.stateContent[i] == undefined) {
                scope.stateContent.splice(i, 1);
                --i;
              }
            }
            scope.saveStateChange('stateContent');
            scope.$apply();
          }
        }
      });
    }
  };
});


function EditorExploration($scope, $http, $timeout, $location, $routeParams,
    stateData, explorationData, warningsData, activeInputData) {
  $scope.getMode = function() {
    if ($location.$$url.substring(0, GUI_EDITOR_URL.length) == GUI_EDITOR_URL) {
      return GUI_EDITOR_URL.substring(1);
    } else {
      return YAML_EDITOR_URL.substring(1);
    }
  };

  /**
   * Changes the editor mode.
   */
  $scope.changeMode = function(mode) {
    if (mode == GUI_EDITOR_URL.substring(1)) {
      $location.path(GUI_EDITOR_URL + '/' + $scope.stateId);
    } else if (mode == YAML_EDITOR_URL.substring(1)) {
      $location.path(YAML_EDITOR_URL + '/' + $scope.stateId);
    } else {
      warningsData.addWarning('Error: mode ' + mode + ' doesn\'t exist.');
    }
  };

  // Initialize data associated with the current state.
  $scope.clearStateVariables = function() {
    $scope.stateId = '';
    $scope.stateName = '';
    $scope.stateContent = [];
    $scope.inputType = '';
    $scope.classifier = '';
    $scope.console = '';
    $scope.widgetCode = '';
  };

  $scope.clearStateVariables();

  // The pathname should be: .../create/{exploration_id}[/{state_id}]
  var pathnameArray = window.location.pathname.split('/');
  $scope.explorationId = pathnameArray[2];
  $scope.explorationUrl = '/create/' + $scope.explorationId;

  // Initializes the exploration page using data from the backend.
  explorationData.getData();

  $scope.$on('explorationData', function() {
    var data = explorationData.data;
    $scope.states = explorationData.states;
    console.log('Data for exploration page:');
    console.log(data);
    $scope.explorationDesc = data.metadata.title;
    $scope.questions = data.exploration_list;
    $scope.initStateId = data.init_state_id;
    $scope.stateId = $routeParams.stateId || $scope.initStateId;
    $scope.isPublic = data.is_public;
    $scope.finiteCode = data.finite_code;
    $scope.numericCode = data.numeric_code;
    $scope.setCode = data.set_code;
    $scope.textCode = data.text_code;
    initJsPlumb();
    drawStateGraph($scope.states);
    stateData.getData($scope.stateId);
  });

  $scope.initializeNewActiveInput = function(newActiveInput) {
    // TODO(sll): Rework this so that in general it saves the current active
    // input, if any, first. If it is bad input, display a warning and cancel
    // the effects of the old change. But, for now, each case is handled
    // specially.
    console.log('Current Active Input: ' + activeInputData.name);
    console.log($scope.stateId);
    if (activeInputData.name == 'stateName') {
      $scope.saveStateName();
    } else if (activeInputData.name == 'questionName') {
      $scope.saveQuestionName();
    }

    var inputArray = newActiveInput.split('.');
    // The format of the array is [CLASSIFIER_TYPE, CATEGORY_ID, ACTION_TYPE]
    // if the newActiveInput is a category/dest input field.
    if (inputArray.length == 3 && inputArray[1] != 'dummy') {
      var dests = $scope.states[$scope.stateId]['dests'];
      var categoryId = Number(inputArray[1]);
      if (inputArray[0] != 'none' && inputArray[0] != 'finite' &&
          inputArray[2] == 'category' &&
          dests[categoryId]['category'] == DEFAULT_CATEGORY_NAME) {
        // If the newActiveInput is a non-editable category, do not proceed.
        return;
      }
    }

    activeInputData.name = (newActiveInput || '');
    // TODO(sll): Initialize the newly displayed field.
  };

  /**
   * Makes this exploration public.
   */
  $scope.makePublic = function() {
    console.log('Publishing exploration');
    $http.put(
        $scope.explorationUrl, '',
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).
            success(function(data) {
              $scope.isPublic = true;
            }).
            error(function(data) {
              warningsData.addWarning('Error publishing exploration: ' + data.error);
            });
  };

  // Adds a new state to the list of states, and updates the backend.
  $scope.addState = function(newStateName, changeIsInline, categoryId) {
    if (!$scope.isValidEntityName(newStateName, true))
      return;
    // States may not start with '[', since that label is reserved for
    // '[Chapter]', '[Question]', etc.
    if (newStateName && newStateName[0] == '[') {
      warningsData.addWarning('State names may not start with \'[\'.');
      return;
    }
    if (newStateName.toUpperCase() == 'END') {
      warningsData.addWarning('Please choose a state name that is not \'END\'.');
      return;
    }
    for (var id in $scope.states) {
      if (id != $scope.stateId && $scope.states[id]['desc'] == newStateName) {
        stateData.getData(id);
        return;
      }
    }

    $scope.addStateLoading = true;
    $http.post(
        $scope.explorationUrl,
        'state_name=' + newStateName,
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).
            success(function(data) {
              $scope.addStateLoading = false;
              // The 'slice' below is needed because it's necessary to clone the
              // array.
              $scope.states[data.stateId] = {
                  desc: data.stateName, dests: DEFAULT_DESTS['none'].slice()};
              $scope.saveStateChange('states');
              $scope.newStateDesc = '';
              if (changeIsInline) {
                $scope.inlineNewNoneStateDesc = '';
                $scope.inlineNewFiniteStateDesc = '';
                $scope.inlineNewNumericStateDesc = '';
                $scope.inlineNewSetStateDesc = '';
                $scope.inlineNewTextStateDesc = '';
                $scope.closeModalWindow();
                activeInputData.clear();

                var oldDest =
                    $scope.states[$scope.stateId].dests[categoryId].dest;

                if (categoryId < $scope.states[$scope.stateId].dests.length) {
                  $scope.states[$scope.stateId].dests[categoryId].dest =
                      data.stateId;
                } else {
                  console.log(
                      'ERROR: Invalid category id ' + String(categoryId));
                  return;
                }
                $scope.saveStateChange('states');
              } else {
                // The content creator added a state from the state list.
                stateData.getData(data.stateId);
              }
            }).error(function(data) {
              $scope.addStateLoading = false;
              warningsData.addWarning(
                  'Server error when adding state: ' + data.error);
            });
  };

  /**
   * Sets up the state editor, given its data from the backend.
   * @param {Object} data Data received from the backend about the state.
   */
  $scope.$on('stateData', function() {
    var data = stateData.data;

    var prevStateId = $scope.stateId;
    $scope.stateId = data.stateId;
    var variableList = ['stateName', 'stateContent', 'inputType', 'classifier',
                        'states'];
    for (var i = 0; i < variableList.length; ++i) {
      // Exclude 'states', because it is not returned from the backend.
      if (variableList[i] != 'states') {
        $scope[variableList[i]] = data[variableList[i]];
      }
    }
    // Update the states using the actions variable.
    $scope.states[$scope.stateId].dests = data.actions;

    console.log('States for editor');
    console.log(data.actions);
    console.log($scope.states);
    console.log(data);

    if ($scope.getMode() == 'gui') {
      $location.path(GUI_EDITOR_URL + '/' + $scope.stateId);

      // If a widget exists, show its compiled version and populate the widget
      // view fields.
      for (var i = 0; i < $scope.stateContent.length; ++i) {
        if ($scope.stateContent[i].type == 'widget') {
          var widgetFrameId = 'widgetPreview' + i;
          // Get the widget with id $scope.stateContent[i].value
          $http.get('/widgets/' + $scope.stateContent[i].value).
              success(function(data) {
                console.log(data);
                $scope.widgetCode = data.raw;
                $scope.addContentToIframe(widgetFrameId, $scope.widgetCode);
              }).error(function(data) {
                warningsData.addWarning(
                    'Widget could not be loaded: ' + String(data.error));
              });
        }
      }
    }

    // Changes the active node in the graph.
    drawStateGraph($scope.states);
  });

  $scope.saveQuestionName = function() {
    if (!$scope.isValidEntityName($scope.explorationDesc, true))
      return;
    if ($scope.isDuplicateInput($scope.questions, 'desc',
            $scope.explorationId, $scope.explorationDesc)) {
      warningsData.addWarning('The name \'' + $scope.explorationDesc +
                        '\' is already in use.');
      return;
    }

    // Note that the change is already saved in $scope.explorationDesc
    // by virtue of Angular JS magic.

    // Send this change directly to the backend (don't save in local storage).
    $scope.saveQuestionNameLoading = true;
    $http.put(
        $scope.explorationUrl + '/data/',
        'exploration_name=' + encodeURIComponent($scope.explorationDesc),
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ).success(function(data) {
      $scope.saveQuestionNameLoading = false;
    }).error(function(data) {
      $scope.saveQuestionNameLoading = false;
      warningsData.addWarning(data.error || 'Error updating exploration.');
    });

    activeInputData.clear();
  };

  $scope.saveStateName = function() {
    if (!$scope.isValidEntityName($scope.stateName, true))
      return;
    if ($scope.isDuplicateInput(
            $scope.states, 'desc', $scope.stateId, $scope.stateName)) {
      warningsData.addWarning(
          'The name \'' + $scope.stateName + '\' is already in use.');
      return;
    }

    $scope.states[$scope.stateId].desc = $scope.stateName;
    editStateVertexName($scope.stateId, $scope.stateName);
    $scope.saveStateChange('states');
    $scope.saveStateChange('stateName');
    activeInputData.clear();
  };

  // Deletes the state with id stateId. This action cannot be undone.
  // TODO(sll): Add an 'Are you sure?' prompt. Later, allow undoing of the
  // deletion.
  $scope.deleteState = function(stateId) {
    if (stateId == $scope.initStateId) {
      warningsData.addWarning('Deleting the initial state of a question is not ' +
          'supported. Perhaps edit it instead?');
      return;
    }

    $scope.clearStateVariables();

    $http.delete(
        $scope.explorationUrl + '/' + stateId + '/data', '',
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ).success(function(data) {
      var edgesDeleted = 0;
      // Remove incoming edges from other states to this state. This must be
      // done to ensure that $scope.states stays up to date.
      for (var id in $scope.states) {
        for (var categoryIndex = 0;
             categoryIndex < $scope.states[id].dests.length;
             ++categoryIndex) {
          if ($scope.states[id].dests[categoryIndex].dest == stateId) {
            $scope.states[id].dests[categoryIndex].dest = id;
            edgesDeleted++;
          }
        }
      }
      if (edgesDeleted) {
        warningsData.addWarning(
            'The categories of some states now no longer have destinations.');
      }

      delete $scope.states[stateId];
      $scope.saveStateChange('states');
      drawStateGraph($scope.states);

      stateData.getData($scope.initStateId);
    }).error(function(data) {
      warningsData.addWarning(data.error || 'Error communicating with server.');
    });
  };

  /************************************************
   * Code for the state graph.
   ***********************************************/
  var stateCanvas = $('#oppia-state-graph-canvas');
  var vertexIds = [];
  var clickDelay = 500;
  // Depth of each node in the graph.
  var levelMap = {};
  // Maximum depth of a node in the graph.
  var maxLevel = 0;
  // Number of nodes already in a given row.
  var rowCount = {};

  initJsPlumb = function() {
    jsPlumb.Defaults.PaintStyle = {
      lineWidth: 2,
      strokeStyle: 'red'
    };
  };

  /**
   * Draws the graph of states.
   * @param {Object} states An object containing all the data (destinations
   *     and category names) needed to draw the state graph.
   */
  drawStateGraph = function(states) {
    // Clear the canvas.
    jsPlumb.reset();
    stateCanvas.html('');
    // Determine positions of the state vertices using breadth-first search.
    vertexIds = [];
    levelMap = {};
    levelMap[$scope.initStateId] = 0;
    maxLevel = 0;
    var seenNodes = [$scope.initStateId];
    var queue = [$scope.initStateId];
    while (queue.length > 0) {
      var currNode = queue[0];
      queue.shift();
      if (currNode in states) {
        for (var i = 0; i < states[currNode].dests.length; i++) {
          // Assign levels to nodes only when they are first encountered.
          if (seenNodes.indexOf(states[currNode].dests[i].dest) == -1) {
            seenNodes.push(states[currNode].dests[i].dest);
            levelMap[states[currNode].dests[i].dest] = levelMap[currNode] + 1;
            maxLevel = Math.max(maxLevel, levelMap[currNode] + 1);
            queue.push(states[currNode].dests[i].dest);
          }
        }
      }
    }
    console.log(levelMap);
    // Initialize rowCount.
    for (var i = 0; i <= maxLevel + 1; ++i) {
      rowCount[i] = 0;
    }
    // Create State vertices
    for (var id in states) {
      createStateVertex(id, states[id].desc);
    }
    // Add edges for each vertex
    for (var id in states) {
      createEdgesForStateVertex(id, states[id].dests);
    }
  };

  /**
   * Creates a new 'ordinary' state node (i.e., not an END or question node) in
   * the graph.
   * @param {string} stateId The id of the node to be created.
   * @param {string} title The text to be displayed in this node.
   */
  createStateVertex = function(stateId, title) {
    var color = 'whitesmoke';
    if (!(stateId in levelMap)) {
      // This state is not reachable from the initial state.
      color = '#FEEFB3';
    }
    createVertex(stateId,
      title,
      color,
      function() {
        $('#editorViewTab a[href="#stateEditor"]').tab('show');
        stateData.getData(stateId);
      },
      function() {
        $scope.deleteState(stateId);
      }
    );
  };

  /**
   * Creates a new graph node with a given color and on-click action.
   * @param {string} id The id of the node to be created.
   * @param {string} title The text to be displayed in this node.
   * @param {string} color The color of the node to be created.
   * @param {function} clickCallback The method that should be called when the
   *     graph node is clicked.
   * @param {function} deleteCallback The method that should be called when
   *     the graph node is deleted.
   */
  createVertex = function(id, title, color, clickCallback, deleteCallback) {
    var last, diff, moved;
    var canEdit = (id != END_DEST);
    var canDelete = canEdit && (id.toString().indexOf(QN_DEST_PREFIX) != 0 &&
        id != $scope.initStateId);

    var vertexId = getVertexId(id);
    if (vertexIds.indexOf(vertexId) != -1) {
      // Vertex already existed
      console.log('Vertex exist! ' + id);
      return;
    }

    var $del = $('<div/>')
    .addClass('oppia-state-graph-vertex-delete')
    .html('&times;')
    .click(function() {
      if (deleteCallback) {
        deleteCallback();
      }
    });

    var $info = $('<div/>')
    .addClass('oppia-state-graph-vertex-info')
    .html('<p>' + title + '</p>');
    if (canEdit) {
      $info
      .addClass('oppia-state-graph-vertex-info-editable')
      .click(function() {
        if (!moved && diff < clickDelay) {
          if (clickCallback) {
            clickCallback();
          }
        }
      });
    }

    var vertexIndex = vertexIds.length;
    var depth = id in levelMap ? levelMap[id] : maxLevel + 1;
    var $vertex = $('<div/>', {id: vertexId})
    .css({
      'background-color': color,
      'border': '2px solid black',
      'border-radius': '50%',
      'left': (80 * rowCount[depth]) + 'px',
      'opacity': 0.8,
      'padding': '8px',
      'position': 'absolute', // Necessary to make div draggable
      'top': (140 * depth) + 'px',
      'z-index': 2 // Yeah! its a magic number I know ;)
    })
    .bind('mousedown', function(e) {
      last = e.timeStamp;
      moved = false;
    })
    .bind('mouseup mousemove', function(e) {
      if (e.type == 'mousemove') {
        moved = true;
        return;
      }
      diff = e.timeStamp - last;
    })
    .prepend($info)
    .prepend(canDelete ? $del : null)
    .appendTo(stateCanvas);

    // Highlight unreachable nodes, the starting node, and the current node.
    if (!(id in levelMap)) {
      $vertex.attr('title', 'This node is unreachable from the start node.');
    }
    if (id == $scope.initStateId) {
      $vertex.attr('title', 'This is the starting node.');
      $vertex.css('border-radius', '20%');
    }
    if (id == $scope.stateId) {
      $vertex.css('border', '5px solid blue');
    }

    rowCount[depth]++;
    jsPlumb.draggable($vertex);

    vertexIds.push(vertexId);
  };

  /**
   * Modifies the name of a graph node.
   * @param {string} stateId The id of the node whose name is to be modified.
   * @param {string} stateName The new text that should be shown in this node.
   */
  editStateVertexName = function(stateId, stateName) {
    $('#' + getVertexId(stateId)).html('<p>' + stateName + '</p>');
  };

  createEdgesForStateVertex = function(stateId, dests) {
    for (var i = 0; i < dests.length; ++i) {
      createEdge(stateId, dests[i].dest, dests[i].category);
    }
  };

  createEdge = function(srcId, destId, label) {
    var srcVertexId = getVertexId(srcId);
    if (vertexIds.indexOf(srcVertexId) == -1) {
      console.log('Edge source should be create first! ' + srcId);
      return;
    }

    var destVertexId = getVertexId(destId);
    if (vertexIds.indexOf(destVertexId) == -1) {
      if (destId.indexOf(QN_DEST_PREFIX) === 0) {
        var questionId = destId.substring(2);
        createVertex(destId,
            '<a>[Question] ' + $scope.questions[questionId].desc + '</a>',
            'lightblue',
            function() {
              window.location = $scope.explorationUrl + '/' + questionId;
            },
            null);
      } else if (destId == END_DEST) {
        createVertex(END_DEST, END_STRING, 'olive', null, null);
      } else {
        console.log('Edge destination is invalid! ' + destId);
        return;
      }
    }

    var srcIndex = vertexIds.indexOf(srcVertexId);
    var destIndex = vertexIds.indexOf(destVertexId);

    var connectInfo = {
      source: $('#' + srcVertexId),
      target: $('#' + destVertexId),
      connector: ['StateMachine', {'curviness': 0}],
      endpoint: ['Dot', {radius: 2}],
      anchor: 'Continuous',
      overlays: [
        ['Arrow', {
          location: 1,
          length: 14,
          foldback: 0.8}],
        ['Label', {label: label, location: 0.35 }]
      ]
    };

    jsPlumb.connect(connectInfo).setDetachable(true);
  };

  getVertexId = function(id) {
    return 'vertexID' + id;
  };
}


function GuiEditor($scope, $http, stateData, explorationData, warningsData, activeInputData) {
  // Clears modal window data when it is closed.
  $scope.closeModalWindow = function() {
    $scope.isModalWindowActive = false;
    $scope.activeModalCategoryId = '';
    $scope.textData = '';
  };

  $scope.closeModalWindow();

  $scope.deleteCategory = function(categoryId) {
    // TODO(wilsonhong): Modify the following to remove the edge corresponding
    // to the specific category ID from the graph (rather than a generic edge
    // from the start node to the destination node).
    $scope.states[$scope.stateId]['dests'].splice(categoryId, 1);
    $scope.saveStateChange('states');
    drawStateGraph($scope.states);
  };

  $scope.showEditorModal = function(actionType, categoryId) {
    // TODO(sll): Get this modal dialog to show up next to the button that was
    // clicked. Do this by getting the DOM object, and the clicked position
    // from it using $(buttonElement).position().left,
    // $(buttonElement).position().top.

    $scope.isModalWindowActive = true;
    $('.editorInput').hide();
    $('#' + actionType + 'Input').show();
    $('.firstInputField').focus();

    if (actionType != 'view') {
      $scope.activeModalCategoryId = categoryId;
      if ($scope.states[$scope.stateId]['dests'][categoryId][actionType]) {
        if (actionType === 'text') {
          $scope[actionType + 'Data'] =
              $scope.states[$scope.stateId]['dests'][categoryId][actionType];
        }
      }
    }
  };

  $scope.getTextDescription = function(text) {
    return text ? 'Feedback: ' + text : '';
  };

  $scope.getDestDescription = function(dest) {
    if (!dest) {
      return 'Error: unspecified destination';
    } else if (dest == END_DEST) {
      return 'Destination: END';
    } else if (dest in $scope.states) {
      return 'Destination: ' + $scope.states[dest].desc;
    } else if (dest.indexOf(QN_DEST_PREFIX) == 0 &&
               dest.substring(2) in $scope.questions) {
      return 'Destination question: ' +
          $scope.questions[dest.substring(2)].desc;
    } else {
      return '[Error: invalid destination]';
    }
  };

  $scope.getCategoryClass = function(categoryName) {
    return categoryName != DEFAULT_CATEGORY_NAME ? 'category-name' : '';
  };

  $scope.saveText = function() {
    var categoryId = $scope.activeModalCategoryId;
    $scope.states[$scope.stateId]['dests'][categoryId]['text'] = $scope.textData;
    $scope.saveStateChange('states');
    $scope.closeModalWindow();
  };

  $scope.saveDest = function(categoryId, destName) {
    if (!destName) {
      warningsData.addWarning('Please choose a destination.');
      return;
    }

    var oldDest = $scope.states[$scope.stateId]['dests'][categoryId].dest;

    var found = false;
    if (destName.toUpperCase() == 'END') {
      found = true;
      $scope.states[$scope.stateId]['dests'][categoryId].dest = END_DEST;
    }
    // If destName is a question, find the id in questions.
    if (destName.indexOf('[Question] ') == 0) {
      destName = destName.substring(11);
      for (var id in $scope.questions) {
        if ($scope.questions[id].desc == destName) {
          found = true;
          $scope.states[$scope.stateId]['dests'][categoryId].dest = 'q-' + id;
          break;
        }
      }
    }
    // Otherwise, find the id in states.
    if (!found) {
      for (var id in $scope.states) {
        if ($scope.states[id].desc == destName) {
          found = true;
          $scope.states[$scope.stateId]['dests'][categoryId].dest = id;
          break;
        }
      }
    }

    if (!found) {
      $scope.addState(destName, true, categoryId);
      return;
    }

    $scope.saveStateChange('states');
    activeInputData.clear();
    drawStateGraph($scope.states);
  };

  /**
   * Saves a change to a state property.
   * @param {String} property The state property to be saved.
   */
  $scope.saveStateChange = function(property) {
    if (!$scope.stateId)
      return;
    activeInputData.clear();

    var requestParameters = {state_id: $scope.stateId};

    if (property == 'stateName') {
      requestParameters['state_name'] = $scope.stateName;
    } else if (property == 'stateContent') {
      // Remove null values from $scope.stateContent.
      $scope.tempstateContent = [];
      for (var i = 0; i < $scope.stateContent.length; ++i) {
        if ($scope.stateContent[i]['value'])
          $scope.tempstateContent.push($scope.stateContent[i]);
      }
      requestParameters['state_content'] = JSON.stringify($scope.tempstateContent);
    } else if (property == 'inputType' || property == 'states') {
      requestParameters['input_type'] = $scope.inputType;
      if ($scope.classifier != 'none' &&
          $scope.states[$scope.stateId]['dests'].length == 0) {
        warningsData.addWarning(
            'Interactive questions should have at least one category.');
        $scope.changeInputType('none');
        return;
      }

      var actionsForBackend = $scope.states[$scope.stateId].dests;
      console.log(actionsForBackend);
      for (var ind = 0;
           ind < $scope.states[$scope.stateId]['dests'].length; ++ind) {
        actionsForBackend[ind]['category'] =
            $scope.states[$scope.stateId]['dests'][ind].category;
        actionsForBackend[ind]['dest'] =
            $scope.states[$scope.stateId]['dests'][ind].dest;
      }
      requestParameters['actions'] = JSON.stringify(actionsForBackend);
    }

    var request = $.param(requestParameters, true);
    console.log('REQUEST');
    console.log(request);

    $http.put(
        $scope.explorationUrl + '/' + $scope.stateId + '/data',
        request,
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ).success(function(data) {
      console.log('Changes saved successfully.');
      drawStateGraph($scope.states);
    }).error(function(data) {
      warningsData.addWarning(data.error || 'Error communicating with server.');
    });
  };

  $scope.getReadableInputType = function(inputType) {
    return HUMAN_READABLE_INPUT_TYPE_MAPPING[inputType];
  };

  /**
   * Triggered when the content creator changes the input type.
   * @param {string} newInputType The input type specified by the content
   *     creator.
   */
  $scope.changeInputType = function(newInputType) {
    $scope.closeModalWindow();
    $scope.inputType = newInputType;
    if (!$scope.inputType) {
      $scope.inputType = 'none';
    }
    if ($scope.inputType == 'none') {
      $scope.newInputType = '';
    }

    $scope.classifier = CLASSIFIER_MAPPING[$scope.inputType];
    if (!$scope.classifier) {
      warningsData.addWarning('Invalid input type: ' + $scope.inputType);
      $scope.classifier = 'none';
    }

    console.log($scope.states[$scope.stateId]);
    // Change $scope.states to the default for the new classifier type.
    $scope.states[$scope.stateId]['dests'] =
        DEFAULT_DESTS[$scope.classifier].slice();

    if ($scope.classifier != 'finite') {
      $scope.saveStateChange('states');
    }
    // Update the graph.
    drawStateGraph($scope.states);
  };

  $scope.hideVideoInputDialog = function(videoLink, index) {
    if (videoLink) {
      // The content creator has added a new video link. Extract its ID.
      if (videoLink.indexOf('http://') == 0)
        videoLink = videoLink.substring(7);
      if (videoLink.indexOf('https://') == 0)
        videoLink = videoLink.substring(8);
      if (videoLink.indexOf('www.') == 0)
        videoLink = videoLink.substring(4);

      // Note that the second group of each regex must be the videoId in order
      // for the following code to work.
      // TODO(sll): Check these regexes carefully (or simplify the logic).
      var videoRegexp1 = new RegExp(
          '^youtube\.com\/watch\\?(.*&)?v=([A-Za-z0-9-_]+)(&.*)?$');
      var videoRegexp2 = new RegExp(
          '^(you)tube\.com\/embed\/([A-Za-z0-9-_]+)/?$');
      var videoRegexp3 = new RegExp('^(you)tu\.be\/([A-Za-z0-9-_]+)/?$');

      var videoId = (videoRegexp1.exec(videoLink) ||
                     videoRegexp2.exec(videoLink) ||
                     videoRegexp3.exec(videoLink));
      if (!videoId) {
        warningsData.addWarning(
            'Could not parse this video link. Please use a YouTube video.');
        return;
      }

      // The following validation method is the one described in
      // stackoverflow.com/questions/2742813/how-to-validate-youtube-video-ids
      // It does not work at the moment, so it is temporarily disabled and replaced
      // with the two lines below it.
      /*
      $http.get('https://gdata.youtube.com/feeds/api/videos/' + videoId[2], '').
          success(function(data) {
            $scope.stateContent[index].value = videoId[2];
            $scope.saveStateChange('stateContent');
          }).error(function(data) {
            warningsData.addWarning('This is not a valid YouTube video id.');
          });
      */
      $scope.stateContent[index].value = videoId[2];
      $scope.saveStateChange('stateContent');
    }
    activeInputData.clear();
  };

  $scope.deleteVideo = function(index) {
    $scope.stateContent[index].value = '';
    $scope.saveStateChange('stateContent');
  };

  $scope.setActiveImage = function(image) {
    $scope.image = image;
  };

  $scope.saveImage = function(index) {
    $('#newImageForm')[0].reset();
    activeInputData.clear();
    image = $scope.image;

    if (!image || !image.type.match('image.*')) {
      warningsData.addWarning('This file is not recognized as an image.');
      return;
    }

    $('#uploadImageLoading').show();
    // The content creator has uploaded an image.
    var form = new FormData();
    form.append('image', image);

    $.ajax({
        url: '/imagehandler/',
        data: form,
        processData: false,
        contentType: false,
        type: 'POST',
        datatype: 'json',
        success: function(data) {
          data = jQuery.parseJSON(data);
          if (data.image_id) {
            $scope.$apply(function() {
              $scope.stateContent[index].value = data.image_id;
              $scope.saveStateChange('stateContent');
            });
          } else {
            warningsData.addWarning(
                'There was an error saving your image. Please retry later.');
          }
          $('#uploadImageLoading').hide();
        },
        error: function(data) {
          warningsData.addWarning(data.error || 'Error communicating with server.');
          $('#uploadImageLoading').hide();
        }
    });
  };

  $scope.deleteImage = function(index) {
    // TODO(sll): Send a delete request to the backend datastore.
    $scope.stateContent[index].value = '';
    $scope.saveStateChange('stateContent');
  };

  // Receive messages from the widget repository.
  $scope.$on('message', function(event, arg) {
    console.log(arg);
    // Save the code. TODO(sll): fix this, the $scope is wrong.
    console.log(arg.data.raw);
    // Send arg.data.raw to the preview. Change tab to preview. Save code in backend.

    var index = -1;
    for (var i = 0; i < $scope.stateContent.length; ++i) {
      if ($scope.stateContent[i].type == 'widget') {
        index = i;
        break;
      }
    }
    if (index == -1) {
      // TODO(sll): Do more substantial error-checking here.
      return;
    }

    $scope.saveWidget(arg.data.raw, index);
  });

  $scope.saveWidget = function(widgetCode, index) {
    $scope.addContentToIframe('widgetPreview' + index, widgetCode);

    // TODO(sll): This does not update the view value when widgetCode is
    // called from the repository. Fix this.
    $scope.widgetCode = widgetCode;
    // TODO(sll): Escape widgetCode first!
    // TODO(sll): Need to ensure that anything stored server-side cannot lead
    //     to malicious behavior (e.g. the user could do his/her own POST
    //     request). Get a security review done on this feature.

    var request = $.param(
        {'raw': JSON.stringify(widgetCode)},
        true
    );
    var widgetId = $scope.stateContent[index].value || '';
    console.log(widgetId);

    $http.post(
      '/widgets/' + widgetId,
      request,
      {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}
    ).success(function(widgetData) {
      // Check that the data has been saved correctly.
      console.log(widgetData);
      $('#widgetTabs' + index + ' a:first').tab('show');
      $scope.stateContent[index].value = widgetData.widgetId;
      $scope.saveStateChange('stateContent');
      // TODO(sll): Display multiple widget div's here.
      activeInputData.clear();
      console.log($scope.stateContent);
    });
  };

  $scope.isWidgetInstateContent = function() {
    for (var i = 0; i < $scope.stateContent.length; ++i) {
      if ($scope.stateContent[i] && $scope.stateContent[i]['type'] == 'widget') {
        return true;
      }
    }
    return false;
  };
}

function YamlEditor($scope, $http, stateData, explorationData, warningsData) {
  // The pathname should be: .../create/{exploration_id}/[state_id]
  var pathnameArray = window.location.pathname.split('/');
  $scope.$parent.explorationId = pathnameArray[2];

  // Initializes the YAML textarea using data from the backend.
  stateData.getData($scope.$parent.stateId);
  $scope.$on('stateData', function() {
    $scope.yaml = stateData.yaml;
  });

  /**
   * Saves the YAML representation of a state.
   */
  $scope.saveState = function() {
    $http.put(
        '/create/convert/' + $scope.$parent.explorationId,
        'state_id=' + $scope.$parent.stateId +
            '&yaml_file=' + encodeURIComponent($scope.yaml),
        {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}).
            success(function(data) {
              $scope.$parent.states[$scope.$parent.stateId] = data.state;
              $scope.$parent.stateContent = data.stateContent;
              $scope.$parent.inputType = data.inputType;
              $scope.$parent.classifier = data.classifier;

              // TODO(sll): Try and do this refresh without requiring an
              // update from the backend.
              stateData.getData($scope.$parent.stateId);
            }).error(function(data) {
              warningsData.addWarning(data.error ||
                  'Error: Could not add new state.');
            });
  };
}

/**
 * Injects dependencies in a way that is preserved by minification.
 */
EditorExploration.$inject = ['$scope', '$http', '$timeout', '$location',
    '$routeParams', 'stateDataFactory', 'explorationDataFactory', 'warningsData',
    'activeInputData'];

GuiEditor.$inject = ['$scope', '$http', 'stateDataFactory',
    'explorationDataFactory', 'warningsData', 'activeInputData'];

YamlEditor.$inject = ['$scope', '$http', 'stateDataFactory', 'explorationDataFactory', 'warningsData'];
