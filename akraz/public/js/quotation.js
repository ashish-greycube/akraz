// Copyright (c) 2026, GreyCube Technologies and contributors
// For license information, please see license.txt

frappe.ui.form.on("Quotation", {
    refresh(frm) {
        if (frm.doc.docstatus == 1) {
            frm.add_custom_button("Create Manufacturing Order", () => {
                frappe.db.get_list("Manufacturing Order AK", {
                    fields: ["name"],
                    filters: { "quotation_reference": frm.doc.name }
                }).then((r) => {
                    // console.log(r, r.length);
                    if (r.length <= 0) {
                        frappe.model.open_mapped_doc({
                            method: "akraz.api.create_manufacturing_order",
                            frm: frm,
                        });
                    } else {
                        frappe.throw("Manufacturing Order for this Quotation already exists.")
                    }
                });
            })
        }
    },
    async validate(frm) {
        for (let item of frm.doc.items) {
            let total_cost = 0
            for (let raw_item of frm.doc.raw_items_cf) {
                if (raw_item.parent_item == item.item_code) {
                    total_cost += raw_item.total
                    console.log(total_cost)
                }
            }
            frappe.model.set_value("Quotation Item", item.name, "total_cost_cf", total_cost)
            frappe.model.set_value("Quotation Item", item.name, "cost_per_pcs_cf", (total_cost / item.qty))
        }

        for (let item of frm.doc.items) {
            let dont_allow_less_rate_than_cost = await frappe.db.get_single_value("Akraz Settings", "do_not_allow_user_to_sell_less_than_cost_rate")

            console.log(dont_allow_less_rate_than_cost, "cost per pcs:", item.cost_per_pcs_cf, "amount: ", item.amount)

            if (item.cost_per_pcs_cf > item.amount && dont_allow_less_rate_than_cost == 1) {
                frappe.throw(`Item Rate lower than Item Cost is not allowed for Item Table Row No. #${item.idx} for Item: <strong>${item.item_name}</strong>.`)
            }
        }
    }
});

frappe.ui.form.on('Quotation Item', {
    add_raw_items_cf(frm, cdt, cdn) {
        let row = locals[cdt][cdn]
        if (row.item_code) {
            frm.add_child('raw_items_cf', {
                parent_item: row.item_code
            })
            frm.refresh_field('raw_items_cf')
        } else {
            frappe.throw(__('Please select Item Code first.'))
        }
    },
})

frappe.ui.form.on('Raw Item AK', {
    qty(frm, cdt, cdn) {
        row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items_cf")
    },
    valuation(frm, cdt, cdn) {
        row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items_cf")
    },
    item_code(frm, cdt, cdn) {
        row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items_cf")
    },
    item_code(frm, cdt, cdn) {
        row = locals[cdt][cdn]

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
    }
})
