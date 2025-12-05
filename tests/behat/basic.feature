@tiny @tiny_gapfill
Feature: Basic tests for Gapfill

  @javascript
  Scenario: Plugin tiny_gapfill appears in the list of installed additional plugins
    Given I log in as "admin"
    When I navigate to "Plugins > Plugins overview" in site administration
    And I follow "Additional plugins"
    Then I should see "Gapfill"
    And I should see "tiny_gapfill"
