// Copyright (c) 2026, GreyCube Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Manufacturing Order AK", {
    async refresh(frm) {
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Create Sales Invoice", () => {
                frappe.model.open_mapped_doc({
                    method: "akraz.api.create_sales_invoice",
                    frm: frm,
                });
            }, "Create")

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
                            },
                            callback(r) {
                                frm.refresh()
                            }
                        })
                    }
                });

                d.show();
            }, "Create")
        }

        if (await validateStockEntries(frm) == true && frm.doc.production_status != "Completed") {
            await frm.set_value("production_status", "Completed")
            await frappe.db.set_value(frm.doc.doctype, frm.doc.name, 'production_status', 'Completed');
            // frm.dirty()
            frm.refresh()
        }
    },
});

async function validateStockEntries(frm) {
    let stock_entry_done_for_all_items = true;

    // 1. Fetch all stock entries linked to this manufacturing order
    const stock_entries = await frappe.db.get_list("Stock Entry", {
        fields: ["name"],
        filters: { "manufacturing_order_ref_cf": frm.doc.name },
        limit: 1000
    });

    console.log("stock_entries", stock_entries);

    // If no stock entries exist at all, return false
    if (!stock_entries || stock_entries.length === 0) {
        return false;
    }

    // 2. Fetch full documents in parallel
    const stock_entry_promises = stock_entries.map(se => frappe.db.get_doc("Stock Entry", se.name));
    const full_stock_entries = await Promise.all(stock_entry_promises);

    // Collect ONLY finished/manufactured items from Stock Entries
    const completed_item_codes = new Set();

    for (let doc of full_stock_entries) {
        if (doc && doc.items) {
            for (let item_row of doc.items) {
                // Debug log to inspect what ERPNext is actually storing in your child table rows
                console.log("Checking Row Item:", item_row.item_code, {
                    is_finished_item: item_row.is_finished_item,
                    s_warehouse: item_row.s_warehouse,
                    t_warehouse: item_row.t_warehouse
                });

                // A finished product MUST have a Target Warehouse (t_warehouse) 
                // and CANNOT have a Source Warehouse (s_warehouse).
                // Raw materials being consumed ONLY have a Source Warehouse.
                const is_finished_good =
                    item_row.is_finished_item === 1 ||
                    (Boolean(item_row.t_warehouse) && !item_row.s_warehouse);

                if (item_row.item_code && is_finished_good) {
                    completed_item_codes.add(item_row.item_code);
                }
            }
        }
    }

    console.log("completed parent item codes:", Array.from(completed_item_codes));

    // 3. Verify if every parent item in the Manufacturing Order exists in completed items
    for (let row of frm.doc.items) {
        if (!completed_item_codes.has(row.item_code)) {
            stock_entry_done_for_all_items = false;
            break; // Exit early if missing
        }
    }

    console.log("Is production complete?", stock_entry_done_for_all_items);

    return stock_entry_done_for_all_items;
}



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
                frm.refresh_field("raw_items")
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
