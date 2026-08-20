// Copyright (c) 2026, GreyCube Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Printing Machine", {
    async onload_post_render(frm) {
        frm.set_query("sulufan", function (doc, cdt, cdn) {
            return {
                filters: {
                    is_sulufan_item: 1,
                },
            };
        });
        frm.set_query("taskeer", function (doc, cdt, cdn) {
            return {
                filters: {
                    is_takseer_item: 1,
                },
            };
        });
    },
});
