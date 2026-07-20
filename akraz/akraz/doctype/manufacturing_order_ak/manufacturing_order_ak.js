// Copyright (c) 2026, GreyCube Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Manufacturing Order AK", {
    refresh(frm) {
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Create Sales Invoice", () => {
                frappe.model.open_mapped_doc({
                    method: "akraz.api.create_sales_invoice",
                    frm: frm,
                });
            })

            frm.add_custom_button("Create Prodution", () => {
                let items_list = []

                for (let row of frm.doc.items) {
                    if (!items_list.includes(row.item_code)) {
                        items_list.push(row.item_code);
                    }
                }

                let d = new frappe.ui.Dialog({
                    title: 'Enter details',
                    fields: [
                        {
                            label: 'Item',
                            fieldname: 'item',
                            fieldtype: 'Select',
                            options: items_list.join("\n")
                        },
                    ],
                    size: 'small', // small, large, extra-large 
                    primary_action_label: 'Create Stock Entry',
                    primary_action(values) {
                        console.log(values);
                        d.hide();

                        frappe.call({
                            method: "akraz.api.create_stock_entry",
                            args: {
                                self: frm.doc,
                                selected_item: values.item
                            }
                        })
                    }
                });

                d.show();
            })
        }
    },
});

frappe.ui.form.on('Manufacturing Order Item AK', {
    add_raw_items(frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        if (row.item_code) {
            frm.add_child('raw_items', {
                parent_item: row.item_code
            })
            frm.refresh_field('raw_items')
        } else {
            frappe.throw(__('Please select Item Code first.'))
        }
    },
})

frappe.ui.form.on('Raw Item AK', {
    qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items")
    },
    valuation(frm, cdt, cdn) {
        let row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items")
    },
    item_code(frm, cdt, cdn) {
        let row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items")

        frappe.call({
            method: "akraz.api.get_valuation_rate_from_stock_balance_report",
            args: {
                filters: {
                    company: frm.doc.company,
                    from_date: frm.doc.transaction_date,
                    to_date: frm.doc.transaction_date,
                    item_code: row.item_code,
                    valuation_field_type: "Currency",
                    include_zero_stock_items: 1
                }
            },
            callback(r) {
                let valuation_rate = r.message

                frappe.model.set_value(cdt, cdn, "valuation", valuation_rate)
                frm.refresh_field("raw_items_cf")
            }
        })

        if (row.item_code == "" || row.item_code == null || row.item_code == undefined || row.item_code == " ") {
            return
        } else {
            console.log(row.item_code, typeof (row.item_code))

            frappe.call({
                method: "erpnext.stock.get_item_details.get_item_details",
                args: {
                    item: row.item_code,
                    args: {
                        "item_code": row.item_code,
                        "warehouse": null,
                        "customer": frm.doc.customer,
                        "conversion_rate": 1.0,
                        "selling_price_list": null,
                        "price_list_currency": null,
                        "plc_conversion_rate": 1.0,
                        "supplier": null,
                        "doctype": "Quotation",
                        "docname": frm.doc.name,
                        "transaction_date": null,
                        "conversion_rate": 1.0,
                        "buying_price_list": null,
                        "is_subcontracted": 0,
                        "ignore_pricing_rule": 0,
                        "project": "",
                        "set_warehouse": "",
                        "company": frappe.defaults.get_user_default("Company") || frappe.defaults.get_global_default("company")
                    }
                },
                callback(r) {
                    // console.log(r.message)
                    let item_details = r.message

                    frappe.model.set_value(cdt, cdn, "warehouse", item_details.warehouse)
                    frm.refresh_field("raw_items")
                }
            })
        }
    }
})
