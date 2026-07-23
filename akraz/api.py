import frappe
import erpnext
from frappe.model.mapper import get_mapped_doc
from erpnext.stock.report.stock_balance.stock_balance import execute 
import json

@frappe.whitelist()
def create_manufacturing_order(source_name: str, target_doc=None, args=None):
	def set_missing_values(source, target):
		target.customer = source.party_name
		target.quotation_reference = source.name
		target.owner = source.owner
		target.date = source.transaction_date

		target.save()

	def is_stock_item_row(row):
		return frappe.get_value("Item", row.item_code, "is_stock_item")

	doclist = get_mapped_doc(
		"Quotation",
		source_name,
		{
			"Quotation": {
				"doctype": "Manufacturing Order AK",
				"validation": {"docstatus": ["=", 1]},
			},
			"Quotation Item": {
				"doctype": "Manufacturing Order Item AK",
			},
			"Raw Item AK": {
				"doctype": "Raw Item AK",
				"condition": is_stock_item_row,
			},
		},
		target_doc,
		set_missing_values,
		# ignore_permissions=ignore_permissions,
	)

	return doclist

@frappe.whitelist()
def create_sales_invoice(source_name: str, target_doc=None, args=None):
	def set_missing_values(source, target):
		target.customer = target.customer
		target.owner = source.owner
		target.posting_date = source.date

		target.manufacturing_ref_cf = source.name

		target.run_method("set_missing_values")
		target.run_method("calculate_taxes_and_totals")

	doclist = get_mapped_doc(
		"Manufacturing Order AK",
		source_name,
		{
			"Manufacturing Order AK": {
				"doctype": "Sales Invoice",
				"validation": {"docstatus": ["=", 1]},
			},
			"Manufacturing Order Item AK": {
				"doctype": "Sales Invoice Item",
			},
			# "Raw Item AK": {
				# "doctype": "Raw Item AK",
			# },
		},
		target_doc,
		set_missing_values,
		# ignore_permissions=ignore_permissions,
	)

	return doclist

@frappe.whitelist()
def create_stock_entry(self, selected_item):
		self = json.loads(self)
		self = frappe._dict(self)

		# isSubmit = frappe.db.get_single_value("Akraz Settings", "is_repack_submit")
		source_warehouse = frappe.db.get_single_value("Stock Settings", "default_warehouse")

		# Parent Level Data
		se_doc = frappe.new_doc('Stock Entry')
		se_doc.stock_entry_type = 'Repack'
		se_doc.company = erpnext.get_default_company()

		# Source Data
		source_items = []
		# Raw Items
		for item in self.raw_items:
			item = frappe._dict(item)
			if item.parent_item == selected_item:
				isPresent = False	
				
				if source_items != []:
					for si in source_items:
						if si['item_code'] ==  item.item_code:
							isPresent = True
							si['qty'] = si['qty'] + item.qty

				if isPresent == False:
					row = frappe._dict({
						's_warehouse' : source_warehouse if not item.warehouse else item.warehouse,
						'item_code' : item.item_code,
						'qty' : item.qty,
					})
					source_items.append(row)
		
		for row in source_items:
			se_doc.append("items", row)

		for main_item in self.get("items"):
			main_item = frappe._dict(main_item)

			if main_item.item_code == selected_item:
				# Target / Actual Data
				row = frappe._dict({
					't_warehouse' : main_item.warehouse,
					'item_code' : main_item.item_code,
					'qty' : main_item.qty,
				})
				se_doc.append("items", row)
				break
		se_doc.manufacturing_order_ref_cf = self.name
		se_doc.save()
		isSubmit = frappe.db.get_single_value("Akraz Settings", "is_repack_submit")
		if isSubmit == 1:
			se_doc.submit()

		frappe.msgprint("Stock Entry is Created: {0}".format(frappe.utils.get_link_to_form("Stock Entry", se_doc.name)))


@frappe.whitelist()
def get_valuation_rate_from_stock_balance_report(filters):
	filters = json.loads(filters)
	filters = frappe._dict(filters)

	if filters.get("item_code") and isinstance(filters.item_code, str):
		filters.item_code = [filters.item_code]

	data = execute(filters)

	if len(data[1]) == 0:
		# frappe.throw("Valuation Rate Is Not Available For Item")
		return 0
	valuation_rate = data[1][0].val_rate

	return valuation_rate


@frappe.whitelist()
def sales_invoice_validate_set_reference_in_mo(self, method=None):
	mo_doc = frappe.get_doc("Manufacturing Order AK", self.manufacturing_ref_cf)
	mo_doc.sales_invoice_reference = self.name
	mo_doc.save()

@frappe.whitelist()
def sales_invoice_submit_set_billing_status_in_mo(self, method=None):
	mo_doc = frappe.get_doc("Manufacturing Order AK", self.manufacturing_ref_cf)
	mo_doc.billing_status = "Billed"
	mo_doc.save()

@frappe.whitelist()
def cancel_sales_invoice_change_mo_billing_status(self, method=None):
	mo_doc = frappe.get_doc("Manufacturing Order AK", self.manufacturing_ref_cf)

	mo_doc.billing_status = "Unbilled"
	mo_doc.sales_invoice_reference = ""

	mo_doc.save()

@frappe.whitelist()
def on_change_si_set_billing_status_in_mo(self, method=None):
	mo_doc = frappe.get_doc("Manufacturing Order AK", self.manufacturing_ref_cf)

	if self.status == "Paid":
		mo_doc.billing_status = "Paid"

		mo_doc.save()
