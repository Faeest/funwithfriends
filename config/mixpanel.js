// config/mixpanel.js
require("dotenv").config();
const Mixpanel = require("mixpanel");

let mixpanelInstance = null;

function getMixpanelInstance() {
	if (!mixpanelInstance || mixpanelInstance === null) {
		if (!process.env.MIXPANEL_PROJECT_TOKEN) {
			console.warn("MIXPANEL_PROJECT_TOKEN not found. Mixpanel tracking will be disabled.");
		} else {
			mixpanelInstance = Mixpanel.init(process.env.MIXPANEL_PROJECT_TOKEN, {
				debug: process.env.NODE_ENV === "development" && false,
				track_pageview: true,
				persistence: "localStorage",
			});
		}
	}
	return mixpanelInstance;
}

module.exports = getMixpanelInstance(); // Export the initialized instance (or mock)
