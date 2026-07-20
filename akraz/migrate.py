from __future__ import unicode_literals

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def after_migrate():
    custom_fields = {
        "Quotation" : [
            {
                "fieldname" : "raw_items_cf",
                "fieldtype" : "Table",
                "label":'Raw Items',
                "insert_after":'items',
                "options": "Raw Item AK",
				"is_custom_field":1,
				"is_system_generated":0,
			},
        ],
        "Sales Invoice" : [
            # {
            #     "fieldname" : "raw_items_cf",
            #     "fieldtype" : "Table",
            #     "label":'Raw Items',
            #     "insert_after":'items',
            #     "options": "Raw Item AK",
			# 	"is_custom_field":1,
			# 	"is_system_generated":0,
			# },
            {
                "fieldname" : "manufacturing_ref_cf",
                "fieldtype" : "Link",
                "label":'Manufacturig Order Reference',
                "insert_after":'items',
                "options": "Manufacturing Order AK",
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
        ],
        "Stock Entry" : [
            {
                "fieldname" : "manufacturing_order_ref_cf",
                "fieldtype" : "Link",
                "label":'Manufacturing Order Reference',
                "insert_after":'apply_putaway_rule',
                "options": "Manufacturing Order AK",
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
        ],

        "Quotation Item" : [
            {
                "fieldname" : "total_cost_cf",
                "fieldtype" : "Float",
                "label":'Total Cost',
                "insert_after":'stock_uom',
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
            {
                "fieldname" : "cost_per_pcs_cf",
                "fieldtype" : "Float",
                "label":'Cost per Pcs',
                "insert_after":'total_cost_cf',
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
            {
                "fieldname" : "add_raw_items_cf",
                "fieldtype" : "Button",
                "label":'Add Raw Items',
                "insert_after":'item_name',
				"is_custom_field":1,
				"is_system_generated":0,
			},
        ],
        "Sales Invoice Item" : [
            {
                "fieldname" : "total_cost_cf",
                "fieldtype" : "Float",
                "label":'Total Cost',
                "insert_after":'stock_uom',
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
            {
                "fieldname" : "cost_per_pcs_cf",
                "fieldtype" : "Float",
                "label":'Cost per Pcs',
                "insert_after":'total_cost_cf',
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
            {
                "fieldname" : "add_raw_items_cf",
                "fieldtype" : "Button",
                "label":'Add Raw Items',
                "insert_after":'item_name',
                "read_only": 1,
				"is_custom_field":1,
				"is_system_generated":0,
			},
        ]
    }
    for dt, fields in custom_fields.items():
        print("*******\n %s: " % dt, [d.get("fieldname") for d in fields])
    create_custom_fields(custom_fields)