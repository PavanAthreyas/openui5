/*!
 * ${copyright}
 */

/* global jQuery */
/* eslint-disable quotes,consistent-this */

sap.ui.define(['jquery.sap.global', 'sap/ui/base/Object', 'sap/ui/test/gherkin/dataTableUtils',
  'sap/ui/test/gherkin/SimpleGherkinParser'], function($, UI5Object, dataTableUtils, SimpleGherkinParser) {
  'use strict';

  /**
   * Generates a generic FeatureTest object based on a Gherkin feature file and a steps definition object. This
   * FeatureTest object can then be used to easily generate tests in any test framework, e.g. QUnit.
   *
   * Full details on how Gherkin is supposed to work are provided on the Gherkin home page:
   * https://github.com/cucumber/cucumber/wiki/Gherkin
   *
   * The standard implementation of Gherkin is in Ruby. This is a JavaScript implementation for English only.
   *
   * This class generates a FeatureTest object. The FeatureTest object is composed of a series of ScenarioTests, each of
   * which is composed of a series of TestSteps. Each TestStep is created by matching a Gherkin test step with a step
   * definition. We expect the test runner to execute each ScenarioTest within its own execution context, and within
   * each scenario to execute each TestStep one after the other.
   *
   * If a TestStep indicates that it should be skipped (e.g. because the generator failed to match the test step to a
   * step definition) then the test runner should not run that step but should still display it. Any unmatched TestSteps
   * will have their 'text' attribute prefixed with "(NOT FOUND)", and then any subsequent steps will be prefixed with
   * "(SKIPPED)". Any scenario or feature annotated with the tag '@wip' will be skipped and have the prefix "(WIP)"
   * added to its text. For a non-wip scenario/feature, any step that is not found should fail the build.
   *
   * The GherkinTestGenerator supports the whole Gherkin feature set except the following:
   *    1. Tags other than '@wip' are ignored
   *    2. Hooks are not supported
   *
   * A FeatureTest object looks like this:
   * <pre>
   * {                                            // {FeatureTest} an executable object for testing a Gherkin feature
   *    name: 'Feature: Serve expensive coffee',  // {string} the feature name from the Gherkin file
   *    wip: false,                               // {boolean} true if the feature is a work in progress
   *    testScenarios: [{                         // {[ScenarioTest]} test scenarios to be run in this FeatureTest
   *      name: 'Scenario: Buy first coffee',     // {string} the scenario name from the Gherkin file
   *      wip: false,                             // {boolean} true if the scenario is a work in progress
   *      testSteps: [{                           // {[TestStep]} test steps that are part of this ScenarioTest
   *        isMatch: true,                        // {boolean} true if the Gherkin scenario matched a step definition
   *        skip: false,                          // {boolean} true if the test step should not be executed
   *        text: 'coffee costs $18 per cup',     // {string} the test step's text as defined in the Gherkin file
   *        regex: /regex/,                       // {regexp} the matching regular expression from step definitions
   *        parameters: [],                       // {[object]} parameters derived from regular expression match
   *        func: function(){}                    // {function} the matching step definition function
   *      },{
   *        isMatch: true,
   *        skip: false,
   *        text: 'I should be served a coffee',
   *        regex: /regex/,
   *        parameters: [],
   *        func: function(){}
   *    }]},{
   *      name: 'Scenario: Buy second coffee',
   *      wip: false,
   *      testSteps: [{
   *        isMatch: true,
   *        skip: false,
   *        text: 'coffee costs $18 per cup',
   *        regex: /regex/,
   *        parameters: [],
   *        func: function(){}
   *      },{
   *        isMatch: true,
   *        skip: false,
   *        text: 'I should be served a second coffee',
   *        regex: /regex/,
   *        parameters: [],
   *        func: function(){}
   *    }]}]
   * }
   * </pre>
   *
   * @param {object | string} vFeature - a feature object generated by sap.ui.test.gherkin.SimpleGherkinParser.
   *                                      Alternatively, this could be the {string} path pointing to a feature file.
   * @param {function} fnStepDefsConstructor - the constructor for a child class of type
   *                                           sap.ui.test.gherkin.StepDefinitions
   * @param {function} [fnAlternateTestStepGenerator] - Optional. If it's specified, this function will be executed
   *                                                    whenever a Gherkin test step has no matching Step Definition. The
   *                                                    function accepts one parameter, a Gherkin test step object with
   *                                                    two {string} attributes 'text' and 'keyword'. The function
   *                                                    returns a TestStep object, as defined above. It is the function
   *                                                    writer's responsibility to prepend "(NOT FOUND)" to the 'text' if
   *                                                    the attribute 'isMatch' is set to 'false'.
   *
   * @class
   * @author Rodrigo Jordao
   * @author Jonathan Benn
   * @extends sap.ui.base.Object
   * @alias sap.ui.test.gherkin.GherkinTestGenerator
   * @since 1.40
   * @public
   */
  var GherkinTestGenerator = UI5Object.extend("sap.ui.test.gherkin.GherkinTestGenerator",
    /** @lends sap.ui.test.gherkin.GherkinTestGenerator.prototype */ {

    constructor : function(vFeature, fnStepDefsConstructor, fnAlternateTestStepGenerator) {
      UI5Object.apply(this, arguments);

      if ($.type(vFeature) === "string") {
        vFeature = SimpleGherkinParser.parseFile(vFeature);

      // else if the type is not a String and not a Feature object
      } else if (($.type(vFeature) !== "object") || !vFeature.scenarios) {
        throw new Error("GherkinTestGenerator constructor: parameter 'vFeature' must be a valid String or a valid Feature object");
      }

      if (($.type(fnStepDefsConstructor) !== "function") || !((new fnStepDefsConstructor()).register)) {
        throw new Error("GherkinTestGenerator constructor: parameter 'fnStepDefsConstructor' must be a valid StepDefinitions constructor");
      }

      if (fnAlternateTestStepGenerator && $.type(fnAlternateTestStepGenerator) !== "function") {
        throw new Error("GherkinTestGenerator constructor: if specified, parameter 'fnAlternateTestStepGenerator' must be a valid Function");
      }

      /**
       * {Feature} a feature object generated by sap.ui.test.gherkin.SimpleGherkinParser
       *
       * @see sap.ui.test.gherkin.SimpleGherkinParser
       * @private
       */
      this._oFeature = vFeature;

      /**
       * {function} the constructor for a child class of type sap.ui.test.gherkin.StepDefinitions
       *
       * @see sap.ui.test.gherkin.StepDefinitions
       * @private
       */
      this._fnStepDefsConstructor = fnStepDefsConstructor;

      /**
       * {StepDefinitions} the concrete StepDefinitions object that holds an array of step definitions
       *
       * @see sap.ui.test.gherkin.StepDefinitions
       * @private
       */
      this._oStepDefs = null;

      /**
       * {function} generates and returns a TestStep object. If this function is defined, it will be executed whenever
       * we fail to find a matching Step Definition for a Gherkin step.
       *
       * @private
       */
      this._fnAlternateTestStepGenerator = fnAlternateTestStepGenerator || null;
    },

    /**
     * Creates a new shared context for running tests. Execute this method before testing a new scenario.
     *
     * @public
     */
    setUp: function() {
      this._oStepDefs = new this._fnStepDefsConstructor();
    },

    /**
     * If any tests were run, executes the Step Definitions' "closeApplication" method. Also clears the shared
     * context for running tests.
     *
     * @public
     */
    tearDown: function() {
      if (this._oStepDefs && this._oStepDefs._needsTearDown) {
        this._oStepDefs.closeApplication();
      }
      this._oStepDefs = null;
    },

    /**
     * Creates a FeatureTest object, which is generated by stitching together the Gherkin Feature File and Step
     * Definitions file inputed to the constructor.
     *
     * @returns {FeatureTest} an executable test object
     * @public
     */
    generate : function() {
      if (!this._oStepDefs) {
        this.setUp();
      }
      return this._generateFeatureTest();
    },

    /**
     * Executes the given TestStep in the shared context of the Step Definitions, with the correct parameters. The
     * TestStep will not be executed if it should be skipped, in which case this method will return 'false'.
     *
     * @param {TestStep} oTestStep - the test step to execute, obtained from the result of 'generate'.
     * @param {boolean} oTestStep.skip - false if the test step should be executed, otherwise true
     * @param {function} [oTestStep.func] - the step definition function to execute (ignored if 'oTestStep.skip' is
     *                                      true)
     * @param {any[]} [oTestStep.parameters] - the parameters to pass to 'oTestStep.func' during its execution
     *                                         (ignored if 'oTestStep.skip' is true)
     * @returns {boolean} true if the test step was executed, otherwise false
     * @throws {error} if you attempt to call this method before calling 'generate' or after calling 'tearDown', or if
     *                 oTestStep is an invalid TestStep object
     * @public
     */
    execute: function(oTestStep) {
      if (!this._oStepDefs) {
        throw new Error("Run 'generate' before calling 'execute'");
      }
      if (!oTestStep ||
        (!oTestStep.skip && (($.type(oTestStep.func) !== "function") || ($.type(oTestStep.parameters) !== "array"))))  {
        throw new Error("Input parameter 'oTestStep' is not a valid TestStep object.");
      }

      // If this test step should not be skipped
      if (!oTestStep.skip) {
        // then execute the test step in the Step Definitions shared context
        oTestStep.func.apply(this._oStepDefs, oTestStep.parameters);
        this._oStepDefs._needsTearDown = true;
      }

      return (!oTestStep.skip);
    },

    /**
     * Creates an executable feature test, composed of 0 or more test scenarios, each of which is composed of 0 or more
     * basic test steps. The generated feature test is based on Gherkin document and step definitions fed into the
     * constructor.
     *
     * @private
     */
    _generateFeatureTest: function() {

      var aTestScenarios = this._oFeature.scenarios.map(function(oScenario) {
        return this._generateTestScenario(oScenario, this._oFeature.background);
      }, this);

      var bFeatureIsWip = ($.inArray('@wip', this._oFeature.tags) !== -1);
      var bAllScenariosAreSkipped = aTestScenarios.every(function(oTestScenario) {
        return oTestScenario.testSteps.every(function(oTest) {
          return oTest.skip;
        });
      });
      var bSkipFeature = bFeatureIsWip || bAllScenariosAreSkipped;

      return {
        name: ((bFeatureIsWip) ? '(WIP) ' : '') + 'Feature: ' + this._oFeature.name,
        skip: bSkipFeature,
        wip: bFeatureIsWip,
        testScenarios: aTestScenarios
      };
    },

    /**
     * Prepares an executable test scenario based on a Gherkin document's scenario, also covering the somewhat more
     * complicated case of scenario outlines. Handles skipping '@wip' scenarios.
     *
     * @param {Scenario} oScenario - the Gherkin scenario for which to generate tests
     * @param {Scenario} oBackground - the Gherkin background scenario that must be run before each regular scenario
     * @returns {TestScenario} - the test scenario to be executed during testing
     * @see sap.ui.test.gherkin.SimpleGherkinParser#parse
     * @private
     */
    _generateTestScenario: function(oScenario, oBackground) {
      var self = this;
      var bWip = $.inArray('@wip', oScenario.tags) !== -1;
      var bIsScenarioOutline = !!oScenario.examples;
      var sScenarioPrependText = (bIsScenarioOutline) ? "Scenario Outline: " : "Scenario: ";
      var sScenarioName = (bWip ? '(WIP) ' : '') + sScenarioPrependText + oScenario.name;
      var aTestSteps = [];
      var bSkip = false;

      if (oBackground) {
        aTestSteps = self._generateTestSteps(bWip, oBackground, false);
        bSkip = (!aTestSteps[0].isMatch);
      }

      if (bIsScenarioOutline) {
        var aExamples = this._convertScenarioExamplesToListOfObjects(oScenario.examples);

        // for each concrete example to be generated
        aExamples.forEach(function(oExample) {

          var oScenarioCopy = $.extend(true, {}, oScenario);

          // for each variable specified for this concrete example (the Feature file data table)
          $.each(oExample, function(sVariableName, sVariableValue) {
            oScenarioCopy.steps.forEach(function(oStep) {
              // in the Scenario text, replace all occurences of the variable with the concrete value
              var sEscapedVariableName = sVariableName.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
              oStep.text = oStep.text.replace(new RegExp('<' + sEscapedVariableName + '>', 'g'), sVariableValue);
            });
          });

          aTestSteps = aTestSteps.concat(self._generateTestSteps(bWip, oScenarioCopy, bSkip));
        });
      } else {
        aTestSteps = aTestSteps.concat(self._generateTestSteps(bWip, oScenario, bSkip));
      }

      return {
        name: sScenarioName,
        wip: bWip,
        testSteps: aTestSteps
      };
    },

    /**
     * Creates all the tests for all of the given scenario's steps. It does this by stitching together the Gherkin
     * specification's steps with the JavaScript step definitions. If any Gherkin step cannot be matched to a
     * JavaScript step definition then that test and all remaining tests will be skipped.
     *
     * If the _fnAlternateTestStepGenerator is defined then it will be used to generate a TestStep if we fail to match
     * a step definition.
     *
     * @param {boolean} bIsWip - true if this test is a work in progress that should be skipped
     * @param {Scenario} oScenario - the Gherkin scenario on which to base these generated tests
     * @param {boolean} bSkipping - true if this scenario and all of its steps should be skipped (e.g. because the
     *                              background step was not found)
     * @returns {TestStep[]} - the list of test step objects to be executed during testing
     * @see sap.ui.test.gherkin.SimpleGherkinParser#parse
     * @private
     */
    _generateTestSteps: function(bIsWip, oScenario, bSkipping) {

      var aTestSteps = [];

      for (var i = 0; i < oScenario.steps.length; ++i) {
        var oStep = oScenario.steps[i];
        var oTestStep = this._oStepDefs._generateTestStep(oStep);

        // if there is no matching regular expression and there is an alternate TestStep generator
        if (!oTestStep.isMatch && this._fnAlternateTestStepGenerator) {
          // then use the alternate function to generate a TestStep
          oTestStep = this._fnAlternateTestStepGenerator(oStep);
        }

        // If there is still not a match
        if (!oTestStep.isMatch) {
          // then we will skip this and all future test steps
          bSkipping = true;
        }

        oTestStep.skip = bSkipping || bIsWip;
        if (oTestStep.isMatch && oTestStep.skip) {
          oTestStep.text = '(SKIPPED) ' + oTestStep.text;
        }
        aTestSteps.push(oTestStep);
      }

      return aTestSteps;
    },

    /**
     * Converts the given scenario outline examples into a list of objects
     *
     * @param {string[][] | string[]} aExamples - scenario outline examples
     * @returns {object[]} - a list of objects equivalent to the input data
     * @see sap.ui.test.gherkin.dataTableUtils.toTable
     * @private
     */
    _convertScenarioExamplesToListOfObjects: function(aExamples) {
      // if aExamples is a simple list then convert from simple list to list-of-lists before executing toTable
      var aExamples = aExamples.map(function(i){return $.type(i) === "string" ? [i] : i;});
      return dataTableUtils.toTable(aExamples);
    }

  });

  return GherkinTestGenerator;
}, /* bExport= */ true);
