# OpenCart UI + Admin + MySQL End-to-End Test Scenario

Implement this scenario following the framework conventions defined in `playwright-mcp-context.md`.

## Objective

Validate a newly registered OpenCart customer across three layers:

1. Frontend customer UI
2. OpenCart Admin Portal
3. MySQL database

The test must use dynamically generated customer data so that every execution creates a unique customer.

## Application Details

### Frontend

- URL: `http://localhost/opencart/upload/`

### Admin Portal

- URL: `http://localhost/opencart/upload/admin/index.php`
- Use the administrator credentials configured for the test environment.

### MySQL

- Host, port, database, username and password: use the current `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` and `DB_PASSWORD` values in `.env`.
- Table: `oc_customer`

## Test Scenario

One independent end-to-end test with the following flow.

### Step 1: Register a Customer Through the Frontend

1. Open `http://localhost/opencart/upload/`.
2. Navigate to **My Account → Register**.
3. Verify that the registration page is displayed.
4. Generate unique test data:
   - First Name
   - Last Name
   - Unique Email Address
   - Telephone
   - Password
   - Password Confirmation
5. Fill all mandatory registration fields.
6. Accept the Privacy Policy.
7. Submit the registration form.
8. Verify that registration succeeds.
9. Verify the expected account-created confirmation, such as **"Your Account Has Been Created!"**.
10. Store the generated customer data for later Admin and database validation.

### Step 2: Verify the Customer in the Admin Portal

1. Open the OpenCart Admin Portal.
2. Log in using configured administrator credentials.
3. Navigate to the **Customers** section.
4. Search for the customer using the unique email address.
5. Verify that the customer exists.
6. Open the customer record/details when applicable.
7. Verify:
   - First Name matches the generated value.
   - Last Name matches the generated value.
   - Email matches the generated value.
   - Customer status is displayed as expected.

### Step 3: Verify the Customer in MySQL

1. Open a MySQL connection using the configured database details.
2. Query `oc_customer` using the unique registered email address.
3. Verify that exactly the expected customer record is found.
4. Validate:
   - `firstname` matches the generated first name.
   - `lastname` matches the generated last name.
   - `email` matches the generated email.
   - `status` matches the expected registration status.
   - `date_added` exists when the column is available.
5. Close the database connection reliably, even when assertions fail.

## Expected Result

The test passes only when the same newly generated customer is successfully:

1. Registered through the frontend.
2. Found and validated in the Admin Portal.
3. Found and validated in the `oc_customer` MySQL table.

If any layer contains mismatched customer data, the test must fail with a clear assertion message.

## Additional Approved Database Scenarios

Keep the registration journey above and add these independent scenarios. Use generated test customers, the existing `executeQuery` utility, Page Objects and custom fixtures. Tag all DB tests with `@master @regression @db`, and UI-backed journeys with `@web @end-to-end`. Parameterized cases also use `@datadriven`.

1. **Duplicate email registration:** Register a customer, then attempt a second registration with different details and the same email. Cover the original and uppercase email forms. Verify the duplicate warning, exactly one DB row, and unchanged original customer fields.
2. **Invalid registration:** Cover missing first name, last name, email, telephone and password, mismatched password confirmation, and an unchecked Privacy Policy. Verify each specific validation message and no customer row for that attempt. When the email is blank, identify the attempt using unique generated non-email fields and keep cleanup scoped to its captured customer ID.
3. **Customer profile update:** Change names, telephone and email through the customer UI. Verify the updated fields, unchanged `customer_id`, unchanged `date_added`, and absence of the old email.
4. **Disable and enable customer:** Change status through Admin. Verify `status=0` and rejected authentication in a fresh session, then `status=1` and successful authentication after enabling the same customer.
5. **Password change:** Change the password through the customer UI. Verify the stored password changes and differs from plaintext, the old password is rejected, and the new password authenticates. Never print passwords or stored hashes in assertion diffs or logs.
6. **Admin deletion:** Delete only the generated customer through Admin. Verify removal of the customer and the related records deleted by the installed OpenCart implementation. Exercise at least one existing child record. Do not assume that every table is deleted by the application; teardown must remove any remaining test-owned rows.
7. **Connection cleanup after SQL errors:** Execute a rejected MySQL statement, verify that its exact connection disappears from the process list, and verify a subsequent parameterized query succeeds. This test must not require a browser or elevated DB privileges and must not rely on global connection counts.

All customer data must be removed after each test, including failures. Capture the customer ID before editing an email or deleting the parent so teardown can still remove related rows. Preserve the configured customer/Admin credentials, shared test data, existing containers and persistent volumes. No Hebrew-name or character-handling scenario is requested.
