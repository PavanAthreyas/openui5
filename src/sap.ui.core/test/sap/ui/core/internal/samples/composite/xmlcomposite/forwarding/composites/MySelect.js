sap.ui.define(['sap/ui/core/XMLComposite'],
	function (XMLComposite) {
		"use strict";
		var MySelect = sap.ui.core.XMLComposite.extend("composites.MySelect", {
			metadata: {
				aggregations: {
					myItems: {
						type: "sap.ui.core.Item",
						multiple: true,
						bindable: "bindable",
						forwarding: { idSuffix: "--itemList", aggregation: "items"}
					}
				},
				defaultAggregation: "myItems"
			}
		});

		return MySelect;
	}, /* bExport= */true);
