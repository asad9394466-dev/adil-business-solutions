# Diyar — Live Form Reference (read from the running app)

Captured directly from the logged-in Diyar app via the browser. Exact field
names are in `[brackets]`; dropdown options in `{braces}`. Use this to match
each screen as we rebuild it in Adil Business Solutions.

---

## Company Information  (`#company-information`)
Tabs: **Company Information · SMS Settings · SMS Templates · Company Logos**

Fields: Company Name `[name]`, Company Name (Urdu) `[name_urdu]`, Address 1 `[address1]`,
Address 2 `[address2]`, Phone `[phone]`, Mobile No. `[mobile]`,
Terms & Conditions `[terms]` (textarea), Ticker Text `[ticker]`.

Printing Options (right panel):
- Invoice/Sales Receipt Template: {Default, Bordered, Standard Bordered, Category-wise Template, Category-wise Template (Qty First)}
- Header Template: {Default, With Company Name in Urdu}

---

## New Invoice  (`#new-invoice`)
Line columns: **# | Item / Scan Barcode | Description | Warehouse | Qty. | Unit | Price | Discount | Amount**

Customer `[customer_id]`, Invoice Date `[invoice_date]`, Due Date `[due_date]`,
Description `[description]`, Reference No `[reference_no]`, Invoice No `[invoice_no]` (auto),
Salesman `[sales_rep_id]`, discount type `[invoice_discount_type]` {Discount Percent / Value},
Order Type `[order_type]` {Local, Mobile, Web, App}.

## New Sales Receipt  (`#new-sales-receipt`)  — walk-in, paid in full
Line columns: **# | Item / Scan Barcode | Description | Warehouse | Qty. | Unit | Price | Discount | Amount**

Customer `[customer_id]` (default **Walk-in Customer**), Sale Date `[sales_receipt_date]`,
Description `[description]`, Sales Receipt No. `[sales_receipt_no]` (auto),
Customer Identity `[sales_rep_id]`, Order Type `[order_type]` {Local, Mobile, Web, App},
Sales Representative `[sale_representative]`,
discount type `[discount_type]` {Discount Percent, Discount Value}, discount `[sales_receipt_discount]`.
(Has an inline "quick add customer" block: customer_type, area_id (Region), price_level_id, customer_code, name, address, phone.)

## New Quotation  (`#new-quotation`)
Line columns: **# | Item | Description | Qty. | Unit | Price | Amount**

Customer `[customer_id]`, Date `[quotation_date]`, Expiry Date `[expiry_date]`,
Description `[description]`, QO No. `[quotation_no]`. (Inline quick-add customer/item.)

## New Sales Order  (`#new-sales-order`)
Line columns: **# | Item | Description | Attribute | Size | Qty. | Unit | Price | Amount**

Customer `[customer_id]`, Date `[order_date]`, Description `[description]`, SO No. `[order_no]`,
Salesman `[sales_rep_id]`, Customer Identity `[customer_identity]` {Local, E-Comm},
Order Type `[order_type]` {Local, Mobile, Web, App}, Sales Representative (Mob. User) `[order_representative]`.

## New Credit Memo / Refund  (`#new-credit-memo`)
Line columns: **# | Item | Description | Warehouse | Qty. | Unit | Price | Discount | Amount**

Refund type `[refund_type]` (radio), Customer `[customer_id]`, Credit Memo Date `[credit_memo_date]`,
Description `[description]`, Credit Memo No. `[credit_memo_no]`, Salesman `[sales_rep_id]`,
Order Type `[order_type]`, Sales Representative `[sale_representative]`,
overall discount `[overall_discount_type]`/`[overall_discount]`,
credit type `[credit_type]` (radio), Account `[account_id]` {Cash in-hand, POS Drawer},
Refund Date `[refund_date]`, Memo `[memo]`.

## New Bill  (`#new-bill`)  — supplier purchase
Line columns: **# | Item | Description | Warehouse | Qty. | Unit | Multiplier | Cost | Discount | Amount | Price Level | Price**

Transaction type `[transaction_type]` (radio), Supplier `[supplier_id]`, Bill Date `[bill_date]`,
Due Date `[due_date]`, Description `[description]`, Reference No. `[reference_no]`, Bill No. `[bill_no]`,
discount `[discount_type]`/`[bill_discount]`, Spread Shipping Charges `[spread_shipping_charges]` + `[shipping_charges]`.

---

## New Item  (`#new-item`)  — large form
Price-level table columns: **Price Level | Price | Warehouse | Quantity**

Type `[itemtype_id]` {Product, Service}, Item Name/Number `[item_name]`, Category `[cat_name]`,
Supplier `[supplier_id]`, Brand `[brand_id]`, COGS Account `[cogs_account_id]`,
Purchase Price `[purchase_price]`, Purchase Description `[purchase_description]`,
Income Account `[income_account_id]`, Regular Price `[regular_price]`, Sale Description `[sale_description]`,
UOM `[unit_set_id]`, Shipping Weight `[shipping_weight]` + unit {kg, gm}, Shipping L/W/H,
UPC `[upc]`, Alternate Lookup `[alt_lookup]`, Size `[size]`, Attributes `[attributes]`,
Gender `[gender]` {MIX, F, M}, Reorder Point `[reorder_point]`, Maximum Order Qty `[maximum_order]`,
Asset Account `[asset_account_id]`, Qty on-hand `[qty_on_hand]`, Total Value `[total_value]`,
Commission `[commission]`, Tax Scheduling `[tax_scheduling]` {Non 3rd Schedule, 3rd Schedule},
Taxable `[taxable]` (checkbox), Images 1–4 `[image1..4]` (file),
Restaurant `[hotel_id]`, Sale Type `[tag]` {HOT, SALE, NEW}, Best Selling Counter `[best_selling_count]`,
Item Origin `[item_origin]`, Price Drop `[price_drop]`, Featured Item `[featured_item]` {No, Yes},
E-Commerce Item `[ecommerce_item]` (checkbox), E-Commerce Description `[ecommerce_description]`,
Item Specification `[item_specification]`, Price Levels `[price_levels[]]` (×4), Qty `[input_qty[]]`.

---

## Settings screens

### Stores  (`#stores`)
List columns: Store ID | Region Name | Store Name | Status | Description | E-Commerce Eligibility
Form: Region `[region_id]`, Name `[store_name]`, Description `[description]`, E-Commerce Eligibility `[ecommerce_eligibility]` (checkbox).

### Warehouses  (`#warehouses`)
List columns: Name | Description | Status
Form: Name `[warehouse_name]`, Description `[description]`, Status `[status_edit]`.

### Price Lists  (`#price-lists`)
List columns: Date | Type | Image
Form: List Date `[list_date]`, List Type `[list_type]` (radio ×3), Price List Image `[list_image]` (file).

### Templates  (`#templates`)
(Loaded slowly / not fully captured — revisit live when building.)

### Users  (`#users`)
List columns: Name | Username | Store | Role | Status
Form: Store `[store_id]` {Main Store}, Role `[role_id]` {Super Administrator, Administrator, Manager, Accountant, Cashier, Delivery Man, Order Processor, Salesman}, Name, Username, Password.

---

## Shared option sets (reuse across forms)
- **Customer Type:** Hotel, Retail, Distributor, Residential, Whole Sale, Cash Receivables, Technician
- **Price Level:** Custom, MRP, Regular, Wholesale
- **Order Type:** Local, Mobile, Web, App
- **Discount Type:** Discount Percent, Discount Value
- **User Roles:** Super Administrator, Administrator, Manager, Accountant, Cashier, Delivery Man, Order Processor, Salesman

## Notes for our build
- Order Type options are **Local / Mobile / Web / App** (update our current Local/Online/Export).
- Discount type label is **"Discount Value"**, not "Discount Amount" — align our wording.
- Many forms embed quick "add customer" / "add item" blocks inside the document editor (select2 "+" actions). We can add these later; for now the standalone screens cover it.
