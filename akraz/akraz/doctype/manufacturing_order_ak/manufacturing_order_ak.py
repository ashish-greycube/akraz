# Copyright (c) 2026, GreyCube Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ManufacturingOrderAK(Document):
	def before_submit(self):
		# if self.production_status == "Pending":
		# 	frappe.throw("You can't submit Manufacturing Order with <strong>Pending</strong> Production Status.")
		pass

	def onload(self):
		for row in self.raw_items:
			is_sheet_item = frappe.get_value("Item", row.item_code, "is_sheet_item")

			if is_sheet_item == 1:
				self.sheet = row.qty
