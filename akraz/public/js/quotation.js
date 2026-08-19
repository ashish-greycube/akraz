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
                if (raw_item.parent_item == item.item_code && raw_item.total != undefined && raw_item.total != "") {
                    total_cost += raw_item.total
                }
            }
            frappe.model.set_value("Quotation Item", item.name, "total_cost_cf", total_cost)
            if (total_cost !== 0 && total_cost !== "" && total_cost !== undefined) {
                frappe.model.set_value("Quotation Item", item.name, "cost_per_pcs_cf", (total_cost / item.qty))
            } else {
                frappe.model.set_value("Quotation Item", item.name, "cost_per_pcs_cf", 0)
            }
            frm.refresh_field("items")
        }

        let dont_allow_less_rate_than_cost = await frappe.db.get_single_value("Akraz Settings", "do_not_allow_user_to_sell_less_than_cost_rate")

        for (let item of frm.doc.items) {
            if (item.cost_per_pcs_cf > item.rate && dont_allow_less_rate_than_cost == 1) {
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
                parent_item: row.item_code,
            })
            frm.refresh_field('raw_items_cf')
        } else {
            frappe.throw(__('Please select Item Code first.'))
        }
    },
})

async function sync_sheet_dependents(frm, sheet_row) {
    // Assumes one sheet row per parent (finished) item, so matching by
    // parent_item alone is enough to find that sheet row's auto-added rows.
    let settings_doc = await frappe.db.get_doc("Akraz Settings")

    // Getting Cost from Printing Machine Doctype
    let machine_doc = ""
    if (frm.doc.machine_type_cf != null && frm.doc.machine_type_cf != "" && frm.doc.machine_type_cf != undefined)
        machine_doc = await frappe.db.get_doc("Printing Machine", frm.doc.machine_type_cf)
    else {
        frappe.throw("Please Set Machine Type.")
    }
    let printing_cost = 0
    for (let i of machine_doc.cost_table) {
        if (sheet_row.qty >= i.from && sheet_row.qty <= i.to) {
            printing_cost = i.cost
            break
        }
    }

    for (let r of frm.doc.raw_items_cf) {
        if (r.parent_item != sheet_row.parent_item || r.name == sheet_row.name) continue

        if ([machine_doc.sulufan, machine_doc.taskeer, machine_doc.uv].includes(r.item_code)) {
            frappe.model.set_value(r.doctype, r.name, "qty", sheet_row.qty)
        }
        if (r.item_code == machine_doc.sulufan) {
            // frappe.model.set_value(r.doctype, r.name, "valuation", sheet_row.valuation)
        }
        if (r.item_code == machine_doc.printing_service) {
            frappe.model.set_value(r.doctype, r.name, "valuation", printing_cost)
        }
    }
    frm.refresh_field("raw_items_cf")
}

frappe.ui.form.on('Raw Item AK', {
    async qty(frm, cdt, cdn) {
        let row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items_cf")

        let is_sheet_item_res = await frappe.db.get_value("Item", row.item_code, "is_sheet_item")
        if (is_sheet_item_res.message.is_sheet_item) {
            await sync_sheet_dependents(frm, row)
        }
    },
    async valuation(frm, cdt, cdn) {
        let row = locals[cdt][cdn]

        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items_cf")

        let is_sheet_item_res = await frappe.db.get_value("Item", row.item_code, "is_sheet_item")
        if (is_sheet_item_res.message.is_sheet_item) {
            await sync_sheet_dependents(frm, row)
        }
    },
    async item_code(frm, cdt, cdn) {
        let row = locals[cdt][cdn]

        // frappe.model.set_value(cdt, cdn, "valuation", row.rate)

        // getting sheet item's parent item's Row
        let parent_row = {}
        for (let pi of frm.doc.items) {
            if (pi.item_code == row.parent_item) {
                parent_row = pi
            }
        }

        // setting total from Qty * Valuation
        frappe.model.set_value(cdt, cdn, "total", (row.qty * row.valuation))
        frm.refresh_field("raw_items_cf")

        // For getting valuation rate from the stock balance report
        let stock_balance_res = await frappe.call({
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
            }
        })
        let sheet_valuation = stock_balance_res.message

        frappe.model.set_value(cdt, cdn, "valuation", sheet_valuation)
        frm.refresh_field("raw_items_cf")

        // Checking if Sheet item or not, getting akraz settings doc
        let is_sheet_item_res = await frappe.db.get_value("Item", row.item_code, "is_sheet_item")
        let is_sheet_item = is_sheet_item_res.message.is_sheet_item
        let settings_doc = await frappe.db.get_doc("Akraz Settings")

        // Getting Cost from Printing Machine Doctype
        let machine_doc = ""
        if (frm.doc.machine_type_cf != null && frm.doc.machine_type_cf != "" && frm.doc.machine_type_cf != undefined)
            machine_doc = await frappe.db.get_doc("Printing Machine", frm.doc.machine_type_cf)
        else {
            frappe.throw("Please Set Machine Type.")
        }

        // Setting Printing Cost, will be used in Printing Service Row
        let printing_cost = 0
        for (let i of machine_doc.cost_table) {
            if (row.qty >= i.from && row.qty <= i.to) {
                printing_cost = i.cost
                break
            }
        }

        frm.refresh_field("raw_items_cf")

        if (is_sheet_item == 1) {
            // Sheet Row: qty already set from parent row; valuation stays the stock balance rate fetched above
            // frappe.model.set_value(cdt, cdn, "qty", parent_row.qty)

            // Getting Taskeer, Tagria, Cover, Basma and UV standard prices from their  production cost (defined in Item)
            let taskeer_price_res = await frappe.db.get_value("Item", machine_doc.taskeer, "production_cost")
            let taskeer_price = taskeer_price_res.message.production_cost

            let tagria_price_res = await frappe.db.get_value("Item", machine_doc.tagria, "production_cost")
            let tagria_price = tagria_price_res.message.production_cost

            let uv_price_res = await frappe.db.get_value("Item", machine_doc.uv, "production_cost")
            let uv_price = uv_price_res.message.production_cost

            let cover_price_res = await frappe.db.get_value("Item", machine_doc.cover, "production_cost")
            let cover_price = cover_price_res.message.production_cost

            let basma_price_res = await frappe.db.get_value("Item", machine_doc.basma, "production_cost")
            let basma_price = basma_price_res.message.production_cost

            // We get sulufan valuation from Sheet Item master -> sulufan rate field
            let sulufan_price_res = await frappe.db.get_value("Item", row.item_code, "sulufan_cost")
            let sulufan_price = sulufan_price_res.message.sulufan_cost

            // Printing Service
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.printing_service,
                qty: 1,
                valuation: printing_cost,
                total: 1 * printing_cost,
                parent_item: row.parent_item
            })
            // Sulufan Row
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.sulufan,
                qty: row.qty,
                valuation: sulufan_price,
                total: row.qty * sulufan_price,
                parent_item: row.parent_item
            })
            // Taskeer Row
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.taskeer,
                qty: row.qty,
                valuation: taskeer_price,
                total: row.qty * taskeer_price,
                parent_item: row.parent_item
            })
            // Tagria Row
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.tagria,
                qty: parent_row.qty,
                valuation: tagria_price,
                total: parent_row.qty * tagria_price,
                parent_item: row.parent_item
            })
            // Cover Row
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.cover,
                qty: parent_row.qty,
                valuation: cover_price,
                total: parent_row.qty * cover_price,
                parent_item: row.parent_item
            })
            // Basma Row
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.basma,
                qty: parent_row.qty,
                valuation: basma_price,
                total: parent_row.qty * basma_price,
                parent_item: row.parent_item
            })
            // UV Row
            frm.add_child("raw_items_cf", {
                item_code: machine_doc.uv,
                qty: row.qty,
                valuation: uv_price,
                total: row.qty * uv_price,
                parent_item: row.parent_item
            })

            frm.refresh_field("raw_items_cf")
        }
    }
})
