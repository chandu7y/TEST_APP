/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["msg/ri/project1/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
