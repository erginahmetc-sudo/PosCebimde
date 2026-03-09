import { supabase } from '../lib/supabaseClient';

// Helper to standardise responses
const response = (data, error) => {
    if (error) {
        console.error('Supabase Error:', error);
        throw { response: { data: { message: error.message || 'Bir hata oluştu' } } };
    }
    return { data };
};

// ============ AUTH API ============
export const authAPI = {
    login: async (email, password) => {

        // Enforce Email Usage
        if (!email.includes('@')) {
            throw { response: { data: { message: 'Lütfen e-posta adresinizi giriniz.' } } };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            if (error.message.includes('Email not confirmed')) {
                throw { response: { data: { message: 'E-posta adresiniz henüz onaylanmamış.' } } };
            }
            throw { response: { data: { message: 'Giriş yapılamadı. Bilgilerinizi kontrol edin.' } } };
        }

        // Fetch user profile for role/permissions AND Company Code
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        let finalProfile = profile || { role: 'user', permissions: {} };

        return {
            status: 200,
            data: {
                token: data.session.access_token,
                user: { ...data.user, ...finalProfile }
            }
        };
    },

    sendOtp: async (email) => {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                shouldCreateUser: false,
            }
        });
        if (error) throw { response: { data: { message: error.message } } };
        return { status: 200, message: 'Doğrulama kodu gönderildi.' };
    },

    verifyOtp: async (email, token) => {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });

        if (error) {
            throw { response: { data: { message: 'Doğrulama kodu hatalı veya süresi dolmuş.' } } };
        }

        // Fetch user profile for role/permissions
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        let finalProfile = profile || { role: 'user', permissions: {} };

        return {
            status: 200,
            data: {
                token: data.session.access_token,
                user: { ...data.user, ...finalProfile }
            }
        };
    },


    logout: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        return { status: 200 };
    },
};

// Helper to get current company code
const getCurrentCompanyCode = () => {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            return user.company_code;
        }
    } catch (e) {
        console.error("Error reading company code", e);
    }
    return null;
};

// ============ PRODUCTS API ============
export const productsAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return { data: { products: [] } };

        let allProducts = [];
        let from = 0;
        let step = 1000;
        let more = true;

        try {
            while (more) {
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('company_code', companyCode)
                    .order('name')
                    .range(from, from + step - 1);

                if (error) throw error;

                if (data && data.length > 0) {
                    allProducts = [...allProducts, ...data];
                    if (data.length < step) {
                        more = false;
                    } else {
                        from += step;
                    }
                } else {
                    more = false;
                }
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }

        // DB columns are now snake_case, same as frontend
        const mappedProducts = allProducts.map(p => ({
            ...p,
            price: p.sale_price, // Map sale_price -> price (frontend uses price)
            group: p.category, // Map category -> group (frontend uses group)
        }));

        return { data: { products: mappedProducts } };
    },
    add: async (product) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) throw new Error("Şirket kodu bulunamadı.");

        // DB columns are snake_case
        const dbProduct = {
            stock_code: product.stock_code,
            name: product.name,
            barcode: product.barcode,
            category: product.group, // Map group -> category
            brand: product.brand,
            sale_price: product.price,
            buying_price: product.buying_price || 0,
            stock: product.stock,
            vat_rate: product.vat_rate || 18,
            image_url: product.image_url,
            company_code: companyCode
        };

        const { data, error } = await supabase
            .from('products')
            .insert([dbProduct])
            .select()
            .single();

        if (error) throw error;
        return { data };
    },
    update: async (stockCode, product) => {
        const companyCode = getCurrentCompanyCode();
        const dbProduct = {
            name: product.name,
            barcode: product.barcode,
            category: product.group,
            brand: product.brand,
            sale_price: product.price,
            buying_price: product.buying_price,
            stock: product.stock,
            vat_rate: product.vat_rate,
            image_url: product.image_url
        };

        const { data, error } = await supabase
            .from('products')
            .update(dbProduct)
            .eq('stock_code', stockCode)
            .eq('company_code', companyCode) // Security check
            .select();

        if (error) throw error;
        return { data };
    },
    delete: async (stockCode) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('stock_code', stockCode)
            .eq('company_code', companyCode); // Security check

        if (error) throw error;
        return { data: { success: true } };
    },
    updateStock: async (stockCode, stockData) => {
        // Updates only stock and related pricing fields
        const updates = {};
        if (stockData.stock !== undefined) updates.stock = stockData.stock;
        if (stockData.buying_price !== undefined) updates.buying_price = stockData.buying_price;
        // if (stockData.sale_price !== undefined) updates.sale_price = stockData.sale_price;

        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('stock_code', stockCode)
            .select();

        if (error) throw error;
        return { data };
    },
    updateImage: async (stockCode, formData) => {
        const file = formData.get('product_image');
        if (!file) return { data: { success: true } };

        const fileExt = file.name.split('.').pop();
        const fileName = `${stockCode}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        // Update product with image_url (snake_case)
        const { error: updateError } = await supabase
            .from('products')
            .update({ image_url: data.publicUrl })
            .eq('stock_code', stockCode);

        if (updateError) throw updateError;
        return { data: { success: true, image_url: data.publicUrl } };
    },
    repairStockCode: async (stockCode) => {
        // 1. Try to find the product (ignoring company filter to catch ghosts if possible)
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('stock_code', stockCode);

        if (error) throw error;

        if (data && data.length > 0) {
            // Found it. Try to delete.
            const { error: delError } = await supabase
                .from('products')
                .delete()
                .eq('stock_code', stockCode);

            if (delError) {
                // If delete fails (likely FK), rename it.
                const newCode = `${stockCode}_DEL_${Math.floor(Date.now() / 1000)}`;
                const { error: updError } = await supabase
                    .from('products')
                    .update({ stock_code: newCode })
                    .eq('stock_code', stockCode);

                if (updError) throw updError;
                return { success: true, message: `Kayıt silinemedi (bağlı veriler var), ancak ${newCode} olarak yeniden adlandırıldı. Artık ${stockCode} kullanılabilir.` };
            }
            return { success: true, message: 'Eski kayıt başarıyla veritabanından silindi.' };
        } else {
            return { success: false, message: 'Bu stok koduna sahip kayıt bulunamadı.' };
        }
    },
};

// ============ CUSTOMERS API ============
export const customersAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, customers: [] });

        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .eq('company_code', companyCode)
            .order('name');

        if (error) return response({ success: true, customers: [] }, error);

        // Calculate balance from customer_payments for each customer
        const customersWithBalance = await Promise.all((customers || []).map(async (customer) => {
            try {
                const { data: payments } = await supabase
                    .from('customer_payments')
                    .select('amount')
                    .eq('customer_id', customer.id);

                // Sum all payments: negative = debt (Borç), positive = credit (Alacak)
                // Balance = sum of all amounts (negative amounts increase debt)
                let calculatedBalance = 0;
                let totalDebt = 0;
                let totalCredit = 0;

                (payments || []).forEach(p => {
                    const amt = parseFloat(p.amount) || 0;
                    calculatedBalance -= amt;
                    if (amt < 0) {
                        totalDebt += Math.abs(amt); // Negative amounts = Borç (debt)
                    } else {
                        totalCredit += amt; // Positive amounts = Alacak (credit/payment)
                    }
                });

                return { ...customer, balance: calculatedBalance, total_debt: totalDebt, total_credit: totalCredit };
            } catch (e) {
                console.warn('Balance calc error for customer', customer.id, e);
                return customer; // Return original if calculation fails
            }
        }));

        return response({ success: true, customers: customersWithBalance }, null);
    },
    add: async (customer) => {
        const companyCode = getCurrentCompanyCode();
        const { id, initial_balance, ...cleanCustomer } = customer;

        // 1. Create customer
        const { data, error } = await supabase
            .from('customers')
            .insert([{ ...cleanCustomer, company_code: companyCode }])
            .select()
            .single();

        if (error) return response({ success: false, message: 'Müşteri oluşturulamadı' }, error);

        // 2. If there's an initial balance, add it as a payment record
        // User Input: + (Debt/Borç), - (Credit/Alacak)
        // System Logic in getAll: - (Debt), + (Credit)
        // So we negate the input: +100 (Debt) becomes -100 (DB Debt). -100 (Credit) becomes +100 (DB Credit).
        if (initial_balance && parseFloat(initial_balance) !== 0) {
            const amount = -1 * parseFloat(initial_balance);
            const { error: payError } = await supabase
                .from('customer_payments')
                .insert({
                    customer_id: data.id,
                    amount: amount,
                    payment_type: 'Açılış Bakiyesi',
                    description: 'Excel ile aktarılan açılış bakiyesi',
                    created_at: new Date().toISOString()
                });

            if (payError) console.error('Initial balance error:', payError);
        }

        return response({ success: true, message: 'Müşteri eklendi', id: data?.id }, error);
    },
    update: async (id, customerData) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('customers')
            .update(customerData)
            .eq('id', id)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Müşteri güncellendi' }, error);
    },
    delete: async (id) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Müşteri silindi' }, error);
    },
    getTransactions: async (customerId) => {
        // For Cari Hareket Raporu, only fetch customer_payments (Borç/Alacak records)
        // Sales table is used for storing sale items/history, not for balance display
        let payments = [];
        try {
            const { data: paymentData, error: paymentsError } = await supabase
                .from('customer_payments')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: true });

            if (paymentsError) {
                console.warn('Payments fetch warning:', paymentsError.message);
            } else {
                payments = paymentData || [];
            }
        } catch (e) {
            console.warn('Payments fetch exception:', e);
        }

        console.log('Fetched customer_payments for transactions:', payments.length);

        // Transform payments to transaction format
        const allTransactions = payments.map(p => ({
            ...p,
            type: 'payment',
            total: Math.abs(p.amount), // Store absolute value, sign indicates direction
            payment_method: p.payment_type?.toLowerCase() || 'nakit',
            // Extract sale_code from description if present (e.g., "Satış - SLS-123" or "İade - RET-123")
            sale_code: p.description?.match(/(SLS|RET)-\d+/)?.[0] || p.description?.match(/Alacak.*-(SLS-\d+)/)?.[1] || null
        }));

        return response({ success: true, transactions: allTransactions }, null);
    },
    addPayment: async (payment) => {
        // Get current customer balance
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', payment.customer_id)
            .single();

        if (fetchError) throw fetchError;

        // Calculate new balance (payment reduces debt)
        const currentBalance = parseFloat(customer?.balance) || 0;
        const paymentAmount = parseFloat(payment.amount) || 0;
        const newBalance = currentBalance - paymentAmount;

        // Save payment record
        const { error: paymentError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: payment.customer_id,
                amount: paymentAmount,
                payment_type: payment.payment_type || 'Nakit',
                description: payment.description || 'Ödeme',
                created_at: new Date().toISOString()
            });

        if (paymentError) {
            console.error('Payment record error:', paymentError);
            // Continue even if payment record fails - balance update is more critical
        }

        // Update customer balance
        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', payment.customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Ödeme alındı ve bakiye güncellendi.' } };
    },
    // NEW: Add Sale Debit (Borç) - Increases customer balance for a sale
    addSaleDebit: async (data) => {
        const { customer_id, amount, sale_code } = data;

        // Get current customer balance
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', customer_id)
            .single();

        if (fetchError) throw fetchError;

        // Calculate new balance (sale INCREASES debt/balance)
        const currentBalance = parseFloat(customer?.balance) || 0;
        const saleAmount = parseFloat(amount) || 0;
        const newBalance = currentBalance + saleAmount;

        // Save Borç (debit) record in customer_payments
        const { error: txError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: customer_id,
                amount: -saleAmount, // Negative to indicate DEBIT (opposite of payment)
                payment_type: 'Borç (Satış)',
                description: `Satış - ${sale_code}`,
                created_at: new Date().toISOString()
            });

        if (txError) {
            console.error('Sale debit record error:', txError);
        }

        // Update customer balance (increase)
        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Borç kaydı oluşturuldu.' } };
    },
    // NEW: Manual Debit (Borç Ekleme) - Increases customer debts without a sale
    addManualDebit: async (data) => {
        const { customer_id, amount, description } = data;

        // Get current customer balance
        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', customer_id)
            .single();

        if (fetchError) throw fetchError;

        // Calculate new balance (Manual Debit INCREASES debt/balance)
        const currentBalance = parseFloat(customer?.balance) || 0;
        const debitAmount = parseFloat(amount) || 0;
        const newBalance = currentBalance + debitAmount;

        // Save Borç (debit) record in customer_payments
        const { error: txError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: customer_id,
                amount: -debitAmount, // Negative to indicate DEBIT (increases balance/debt)
                payment_type: 'Borç (Manuel)',
                description: description || 'Manuel Borç Ekleme',
                created_at: new Date().toISOString()
            });

        if (txError) {
            console.error('Manual debit record error:', txError);
        }

        // Update customer balance (increase)
        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Borç kaydı işlendi.' } };
    },
    addPurchaseTransaction: async (data) => {
        // This is for processing an invoice FROM a supplier (who is recorded as a customer)
        const { customer_id, amount, description } = data;

        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', customer_id)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(customer?.balance) || 0;
        const txAmount = parseFloat(amount) || 0;
        const newBalance = currentBalance - txAmount; // Purchase decreases our receivable (increases our debt)

        // Add record to payments table (as a negative payment or specific type)
        // Using 'Fatura' as payment_type to distinguish
        const { error: txError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: customer_id,
                amount: txAmount, // Store positive number
                payment_type: 'Fatura (Alış)', // Type
                description: description || 'Gelen Fatura',
                created_at: new Date().toISOString()
            });

        if (txError) console.error('Transaction record error:', txError);

        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Cari hesaba işlendi.' } };
    },
    cancelPurchaseTransaction: async (data) => {
        // This reverses a processed invoice - increases customer balance (removes debt)
        const { customer_id, amount, description } = data;

        const { data: customer, error: fetchError } = await supabase
            .from('customers')
            .select('balance')
            .eq('id', customer_id)
            .single();

        if (fetchError) throw fetchError;

        const currentBalance = parseFloat(customer?.balance) || 0;
        const txAmount = parseFloat(amount) || 0;
        const newBalance = currentBalance + txAmount; // Cancellation increases balance (removes debt)

        // Add record to payments table as cancellation
        const { error: txError } = await supabase
            .from('customer_payments')
            .insert({
                customer_id: customer_id,
                amount: -txAmount, // Negative to indicate reversal
                payment_type: 'Fatura İptali',
                description: description || 'Fatura İptali',
                created_at: new Date().toISOString()
            });

        if (txError) console.error('Cancel transaction record error:', txError);

        const { error: updateError } = await supabase
            .from('customers')
            .update({
                balance: newBalance,
                last_transaction_date: new Date().toISOString()
            })
            .eq('id', customer_id);

        if (updateError) throw updateError;
        return { data: { success: true, message: 'Fatura iptali cariye işlendi.' } };
    },
    deletePayment: async (id, customerId, amount) => {
        // 1. Delete payment record
        const { error: deleteError } = await supabase
            .from('customer_payments')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        // 2. Update customer balance (Add amount back because payment reduced it)
        try {
            // First get current balance
            const { data: customer, error: fetchError } = await supabase
                .from('customers')
                .select('balance')
                .eq('id', customerId)
                .single();

            if (fetchError) throw fetchError;

            // Make sure amount is treated as positive for calculation
            const amountToAdd = Math.abs(parseFloat(amount));
            const newBalance = (customer.balance || 0) + amountToAdd;

            const { error: updateError } = await supabase
                .from('customers')
                .update({ balance: newBalance })
                .eq('id', customerId);

            if (updateError) throw updateError;

            return { data: { success: true, message: 'Ödeme silindi ve bakiye güncellendi.' } };
        } catch (error) {
            console.error('Balance rollback error:', error);
            // Even if balance update fails, payment is deleted. 
            // We might want to handle this better but for now logging is critical.
            return { data: { success: true, warning: 'Ödeme silindi fakat bakiye güncellenemedi.' } };
        }
    },
    // Update payment amount and adjust customer balance
    updatePayment: async (paymentId, customerId, oldAmount, newAmount) => {
        // Calculate the difference for balance adjustment
        const difference = Math.abs(newAmount) - Math.abs(oldAmount);

        // Update the payment record
        const { error: updatePaymentError } = await supabase
            .from('customer_payments')
            .update({ amount: newAmount })
            .eq('id', paymentId);

        if (updatePaymentError) throw updatePaymentError;

        // Adjust customer balance
        // If new amount is higher, balance decreases more (customer paid more)
        // If new amount is lower, balance increases (customer paid less)
        try {
            const { data: customer, error: fetchError } = await supabase
                .from('customers')
                .select('balance')
                .eq('id', customerId)
                .single();

            if (fetchError) throw fetchError;

            const newBalance = (customer.balance || 0) - difference;

            const { error: balanceError } = await supabase
                .from('customers')
                .update({ balance: newBalance, last_transaction_date: new Date().toISOString() })
                .eq('id', customerId);

            if (balanceError) throw balanceError;

            return { data: { success: true, message: 'Ödeme güncellendi.' } };
        } catch (error) {
            console.error('Balance adjustment error:', error);
            return { data: { success: true, warning: 'Ödeme güncellendi fakat bakiye ayarlanamadı.' } };
        }
    }
};

// ============ SALES API ============
export const salesAPI = {
    getAll: async (params) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, sales: [] });

        let query = supabase.from('sales').select('*, customers(name)').eq('company_code', companyCode);

        if (params?.start_date) query = query.gte('date', `${params.start_date}T00:00:00`);
        if (params?.end_date) query = query.lte('date', `${params.end_date}T23:59:59`);
        if (params?.sale_code) query = query.ilike('sale_code', `%${params.sale_code}%`);
        if (params?.customer_id) query = query.eq('customer_id', params.customer_id);
        if (params?.only_deleted) {
            query = query.eq('is_deleted', true);
        } else if (!params?.show_deleted) {
            query = query.eq('is_deleted', false);
        }

        const { data, error } = await query.order('date', { ascending: false });

        let sales = data?.map(s => ({
            ...s,
            customerName: s.customers?.name,
            customer: s.customers?.name || s.customer_name || s.customer || 'Misafir'
        })) || [];

        // Filter by customer name in JS since it's a relationship
        if (params?.customer_name) {
            const term = params.customer_name.toLowerCase();
            sales = sales.filter(s => s.customer?.toLowerCase().includes(term));
        }

        return response({ success: true, sales }, error);
    },
    createReturn: async (originalSale, returnedItems) => {
        const companyCode = getCurrentCompanyCode();
        // 1. Calculate Refund Total
        const refundTotal = returnedItems.reduce((sum, item) => {
            const price = parseFloat(item.price) || 0;
            const discount = parseFloat(item.discount_rate) || 0;
            const qty = parseFloat(item.return_quantity) || 0;
            return sum + (price * qty * (1 - discount / 100));
        }, 0);

        // 2. Prepare Return Sale Record
        // We embed the original sale code in the return code for tracking
        // Return code format: RET-[OriginalCode]-[TimestampSuffix]
        // Example: RET-SLS-1715-9384
        const timestampSuffix = Date.now().toString().slice(-4);
        // Ensure we don't double-prefix if original is already malformed, but assume original is SLS-xxx
        // If original is manual (S-xxx), it works too.
        const returnSaleCode = `RET-${originalSale.sale_code}-${timestampSuffix}`;

        const returnSale = {
            sale_code: returnSaleCode, // NEW Linked Code
            items: returnedItems.map(i => ({ ...i, quantity: i.return_quantity, original_sale_code: originalSale.sale_code })),
            total: -refundTotal, // NEGATIVE TOTAL
            payment_method: 'İade', // Explicit type
            customer_id: originalSale.customer_id,
            customer_name: originalSale.customer_name || originalSale.customer || 'Misafir',
            date: new Date().toISOString(),
            company_code: companyCode,
            is_deleted: false
        };

        // 3. Insert Return Sale
        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert([returnSale])
            .select()
            .single();

        if (saleError) throw { response: { data: { message: 'İade kaydı oluşturulamadı: ' + saleError.message } } };

        // 4. Update Stock (Increase)
        for (const item of returnedItems) {
            if (!item.stock_code) continue;

            // Fetch current stock first to be safe
            const { data: currentProd } = await supabase
                .from('products')
                .select('stock')
                .eq('stock_code', item.stock_code)
                .eq('company_code', companyCode)
                .single();

            if (currentProd) {
                const newStock = (currentProd.stock || 0) + parseFloat(item.return_quantity);
                await supabase
                    .from('products')
                    .update({ stock: newStock })
                    .eq('stock_code', item.stock_code)
                    .eq('company_code', companyCode);
            }
        }

        // 5. Update Customer Balance
        // Logic:
        // - We create a "Sale Debit" logic with NEGATIVE amount (which means Credit).
        // - customersAPI.addSaleDebit expects 'amount'. Logic inside: balance + amount.
        // - If we pass -100: balance + (-100) = balance - 100.
        // - This reduces the Debt. Correct.
        if (returnSale.customer_id) {
            await customersAPI.addPayment({
                customer_id: returnSale.customer_id,
                amount: refundTotal, // Positive amount for Payment/Credit
                payment_type: 'İade', // Explicit type
                description: `İade - ${returnSale.sale_code}`
            });
        }

        return response({ success: true, message: 'İade işlemi tamamlandı.' });
    },
    complete: async (sale) => {
        // Prepare items for JSON storage
        // Handle both 'items' (pre-mapped) and 'products' (needs mapping)
        let items = [];
        if (sale.items) {
            items = sale.items;
        } else if (sale.products) {
            items = sale.products.map(p => ({
                id: p.id,
                name: p.name,
                quantity: p.quantity,
                price: p.price,
                total: p.price * p.quantity
            }));
        }

        const companyCode = getCurrentCompanyCode();

        const cleanSale = {
            sale_code: sale.sale_code || `S-${Date.now()}`,
            items: items, // Supabase handles JSON automatically
            total: sale.total,
            payment_method: sale.payment_method,
            is_deleted: false,
            date: new Date().toISOString(),
            customer_id: sale.customer_id || (sale.customer && sale.customer.id) || null, // Handle customer object or ID
            customer_name: sale.customer_name || (sale.customer && sale.customer.name) || (typeof sale.customer === 'string' ? sale.customer : '') || 'Misafir', // NEW: Store name explicitly
            company_code: companyCode
        };

        const { data, error } = await supabase
            .from('sales')
            .insert([cleanSale])
            .select()
            .single();

        if (error) {
            console.error('Sale insert error:', error);
            throw { response: { data: { message: error.message || 'Satış kaydedilemedi' } } };
        }

        // DOUBLE-ENTRY ACCOUNTING:
        // Step 1: Add Borç (Debit) for ALL sales with registered customer - increases their balance
        if (cleanSale.customer_id) {
            try {
                await customersAPI.addSaleDebit({
                    customer_id: cleanSale.customer_id,
                    amount: cleanSale.total,
                    sale_code: cleanSale.sale_code
                });
                console.log('Borç (debit) record created for sale:', cleanSale.sale_code);
            } catch (debitError) {
                console.error('Borç creation failed:', debitError);
            }

            // Step 2: For Nakit/POS/Kredi Kartı sales, add Alacak (Credit) - offsets the debit
            if (cleanSale.payment_method === 'Nakit' || cleanSale.payment_method === 'POS' || cleanSale.payment_method === 'Kredi Kartı') {
                try {
                    await customersAPI.addPayment({
                        customer_id: cleanSale.customer_id,
                        amount: cleanSale.total,
                        payment_type: cleanSale.payment_method === 'POS' ? 'Kredi Kartı' : 'Nakit',
                        description: `Alacak (Tahsilat) - ${cleanSale.sale_code}`
                    });
                    console.log('Alacak (credit) record created for sale:', cleanSale.sale_code);
                } catch (paymentError) {
                    console.error('Alacak creation failed:', paymentError);
                }
            }
            // NOTE: For Veresiye/Açık Hesap - no Alacak is added, so balance stays increased (debt)
        }

        return response({ success: true, message: 'Satış tamamlandı', sale_code: data?.sale_code }, error);
    },
    // Alias for backward compatibility if needed
    add: async (sale) => { return salesAPI.complete(sale); },
    delete: async (saleCode) => {
        const companyCode = getCurrentCompanyCode();

        // 1. Get Sale Details to find Customer
        const { data: sale, error: fetchError } = await supabase
            .from('sales')
            .select('customer_id')
            .eq('sale_code', saleCode)
            .eq('company_code', companyCode) // Ensure fetch respects company code
            .single();

        if (fetchError) {
            console.error('Sale fetch error during delete:', fetchError);
        } else if (sale && sale.customer_id) {
            // 2. Remove Financial Records (Double-Entry) from Customer Ledger
            // We need to delete BOTH the Debit (Borç) and Credit (Alacak) records associated with this sale.
            // Patterns used in creation:
            // Debit: `Satış - ${saleCode}`
            // Credit: `Alacak (Tahsilat) - ${saleCode}` (for Nakit/POS)

            // We can delete both by matching the sale code in the description
            const { error: ledgerError } = await supabase
                .from('customer_payments')
                .delete()
                .eq('customer_id', sale.customer_id)
                .ilike('description', `%${saleCode}%`); // Match any record containing the sale code

            if (ledgerError) {
                console.error('Error deleting associated ledger records:', ledgerError);
            }
        }

        // 3. Soft Delete the Sale (Standard for history)
        const { error } = await supabase
            .from('sales')
            .update({ is_deleted: true })
            .eq('sale_code', saleCode);
        return response({ success: true, message: 'Satış iptal edildi' }, error);
    },
    getByCode: async (saleCode) => {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('sale_code', saleCode)
            .single();
        return response(data, error);
    },
    update: async (saleCode, data) => {
        const companyCode = getCurrentCompanyCode();

        // 1. Fetch existing sale for customer_id validation and total check
        const { data: existingSale, error: fetchError } = await supabase
            .from('sales')
            .select('customer_id, total')
            .eq('sale_code', saleCode)
            .eq('company_code', companyCode)
            .single();

        if (fetchError || !existingSale) throw fetchError || new Error("Satış bulunamadı");

        const updateData = {};
        // Database uses 'items' column for products
        if (data.products) updateData.items = data.products;
        if (data.total !== undefined) updateData.total = data.total;
        if (data.payment_method !== undefined) updateData.payment_method = data.payment_method;
        if (data.customer_id !== undefined) updateData.customer_id = data.customer_id;
        if (data.customer_name !== undefined) updateData.customer_name = data.customer_name;

        // 2. Update Sales Table
        const { error } = await supabase
            .from('sales')
            .update(updateData)
            .eq('sale_code', saleCode)
            .eq('company_code', companyCode);

        if (error) throw error;

        // 3. Sync Customer Ledger (Only if total changed and customer exists)
        // We use the existing customer_id from the sale (or the new one if updated)
        const targetCustomerId = data.customer_id || existingSale.customer_id;

        if (targetCustomerId && data.total !== undefined && parseFloat(data.total) !== parseFloat(existingSale.total)) {
            const newTotal = parseFloat(data.total);

            // Update DEBIT (Borç) - identified by negative amount and description containing sale code
            // Note: Description format involves "Satış - SALE-123" or similar
            const { error: debitError } = await supabase
                .from('customer_payments')
                .update({ amount: -newTotal }) // Debit is negative (increases debt)
                .eq('customer_id', targetCustomerId)
                .ilike('description', `%${saleCode}%`)
                .lt('amount', 0); // Ensure we target the debt record

            if (debitError) console.error("Error updating ledger debit:", debitError);

            // Update CREDIT (Alacak/Tahsilat) - identified by positive amount and description containing sale code
            // Only if it exists (e.g. was Nakit/Card payment). If it was Veresiye, this record won't exist.
            const { error: creditError } = await supabase
                .from('customer_payments')
                .update({ amount: newTotal }) // Credit is positive (decreases debt)
                .eq('customer_id', targetCustomerId)
                .ilike('description', `%${saleCode}%`)
                .gt('amount', 0); // Ensure we target the payment record

            if (creditError) console.error("Error updating ledger credit:", creditError);

            // 4. Update Customer Balance (Recalculate to be safe)
            try {
                const { data: allPayments } = await supabase
                    .from('customer_payments')
                    .select('amount')
                    .eq('customer_id', targetCustomerId);

                // Debt is negative, Credit is positive.
                // Balance = SUM(Debts) - SUM(Credits) ... Wait, existing calculation was:
                // reduce((sum, p) => sum - (parseFloat(p.amount) || 0), 0);
                // So if amount is -100 (Debt), sum - (-100) = sum + 100.
                // If amount is +100 (Credit), sum - (+100) = sum - 100.
                // This matches "Balance = Total Debt - Total Credit".

                const calculatedBalance = (allPayments || []).reduce((sum, p) => sum - (parseFloat(p.amount) || 0), 0);

                await supabase
                    .from('customers')
                    .update({
                        balance: calculatedBalance,
                        last_transaction_date: new Date().toISOString()
                    })
                    .eq('id', targetCustomerId);
            } catch (balanceError) {
                console.error("Error recalculating balance:", balanceError);
            }
        }

        return response({ success: true, message: 'Satış ve cari hesap güncellendi' }, null);
    }
};

// ============ USERS API ============
export const usersAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, users: [] });

        const { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('company_code', companyCode);
        return response({ success: true, users: data || [] }, error);
    },
    add: async (user) => {
        // 1. Try standard SignUp with metadata
        let { data, error } = await supabase.auth.signUp({
            email: user.email,
            password: user.password,
            options: {
                data: {
                    username: user.username,
                    role: user.role || 'user',
                    permissions: user.permissions,
                    access_schedule: user.access_schedule,
                    company_code: getCurrentCompanyCode() // Assign current admin's company
                }
            }
        });

        // 2. Fallback: If "Database error" (Trigger failure?), try without metadata
        if (error && error.message && error.message.includes('Database error')) {
            console.warn('Metadata signUp failed, retrying without metadata...');
            const retry = await supabase.auth.signUp({
                email: user.email,
                password: user.password
            });
            data = retry.data;
            error = retry.error;
        }

        if (error) {
            // If user already exists, Supabase vaguely says so or returns fake success (security).
            // But if it's an error object:
            return response(null, error);
        }

        // Supabase returns a fake user with empty identities if duplicate email exists (and email confirm is enabled/security settings)
        // This causes the FK error when trying to insert into user_profiles
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            return response(null, { message: 'E-Mail daha önce kaydedilmiştir.' });
        }

        if (data.user) {
            // 3. Manually insert/update profile
            // We use upsert in case a Trigger partially created it
            const { error: profileError } = await supabase.from('user_profiles').upsert({
                id: data.user.id,
                username: user.username,
                // email: user.email, // Removed to prevent "Column not found" error if schema is old
                role: user.role || 'user',
                permissions: user.permissions,
                access_schedule: user.access_schedule,
                company_code: getCurrentCompanyCode()
                // session_token: crypto.randomUUID() // Removed due to missing DB column
            });

            if (profileError) {
                console.error('Profile create error:', profileError);
                return response({ success: true, message: 'Kullanıcı oluşturuldu ancak profil detayları kaydedilemedi: ' + profileError.message }, null);
            }
        }

        return response({ success: true, message: 'Kullanıcı eklendi.' }, null);
    },
    delete: async (id) => {
        // Note: This only deletes from user_profiles. Supabase Auth user remains unless deleted via Admin API.
        const { error } = await supabase.from('user_profiles').delete().eq('id', id);
        return response({ success: true, message: 'Kullanıcı profili silindi' }, error);
    },
    updatePermissions: async (id, permissions) => {
        // Fix: backend expects object with permissions key, but here we just pass permissions object
        // Adjusting to match whatever usage pattern, assuming permissions is the object { can_view_...: true }
        const { error } = await supabase
            .from('user_profiles')
            .update({ permissions })
            .eq('id', id);
        return response({ success: true, message: 'Yetkiler güncellendi' }, error);
    },
    update: async (id, userData) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({
                username: userData.username,
                role: userData.role,
                // permissions and access_schedule are handled by separate methods usually, 
                // but can be here if we want full update. 
                // For this feature, we focus on basic info + role.
            })
            .eq('id', id);
        return response({ success: true, message: 'Kullanıcı bilgileri güncellendi' }, error);
    },
    updateSchedule: async (id, schedule) => {
        const { error } = await supabase
            .from('user_profiles')
            .update({ access_schedule: schedule })
            .eq('id', id);
        return response({ success: true, message: 'Erişim takvimi güncellendi' }, error);
    },
    forceLogout: async (id) => {
        // Increment session_version to invalidate old sessions
        const { error } = await supabase.rpc('increment_session_version', { user_id: id });

        if (error) {
            // Fallback if RPC doesn't exist (though we should create it, or use direct update)
            // Direct update: session_version = session_version + 1 (not easily done in one query without RPC or fetch first)
            // Let's fetch first then update
            const { data: user, error: fetchError } = await supabase
                .from('user_profiles')
                .select('session_version')
                .eq('id', id)
                .single();

            if (user) {
                const newVersion = (user.session_version || 1) + 1;
                await supabase
                    .from('user_profiles')
                    .update({ session_version: newVersion })
                    .eq('id', id);
            }
        }

        return response({ success: true, message: 'Kullanıcı oturumu kapatıldı.' }, null);
    },
    // Check session version
    getSessionVersion: async (id) => {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('session_version')
            .eq('id', id)
            .single();
        return { version: data?.session_version, error };
    },
    updatePassword: async (id, newPassword) => {
        // Client-side cannot update other users' passwords safely without Admin API.
        // We will just return a message saying it's not supported in this version or needs Admin Panel.
        return { data: { success: false, message: "Parola değiştirme işlemi için Yönetici Paneli gereklidir (Client-Side kısıtlaması)." } };
    },
    registerTenant: async (userData) => {
        // 1. SignUp
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                emailRedirectTo: `${window.location.origin}/email-success`,
                data: {
                    username: userData.username,
                    role: 'kurucu',
                    company_code: userData.company_code
                }
            }
        });

        if (error) return response(null, error);

        // Supabase security: If email exists, it might return a user with empty identities
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            return response(null, { message: 'Bu e-posta adresi ile zaten kayıtlı bir kullanıcı var.' });
        }

        if (data.user) {
            // 2. Create Profile with Company Code
            const { error: profileError } = await supabase.from('user_profiles').upsert({
                id: data.user.id,
                username: userData.username,
                role: 'kurucu',
                company_code: userData.company_code,
                permissions: {
                    // Founders get full access by default logic, but we can be explicit
                    can_view_products: true,
                    can_view_customers: true,
                    can_view_sales: true,
                    can_view_invoices: true,
                    can_view_pos: true,
                    can_view_users: true,
                    can_view_balances: true,
                    can_view_prices: true
                }
            });

            if (profileError) {
                console.error('Tenant profile error:', profileError);
                return response({ success: true, message: 'Kayıt oldu ancak profil hatası: ' + profileError.message }, null);
            }

            // 3. Generate Secret Token for Integrations
            // We do this manually here because the user is not logged in yet (no localStorage), 
            // so we can't use settingsAPI.set() which relies on getCurrentCompanyCode().
            try {
                const secretToken = crypto.randomUUID();
                const { error: settingsError } = await supabase
                    .from('app_settings')
                    .insert({
                        key: 'secret_token',
                        value: secretToken,
                        company_code: userData.company_code
                    });

                if (settingsError) {
                    console.error('Secret token generation error:', settingsError);
                    // Don't fail the registration for this, but log it
                }
            } catch (tokenError) {
                console.error('Secret token generation exception:', tokenError);
            }
        }

        return response({ success: true, message: 'Şirket kaydı başarıyla oluşturuldu.' }, null);
    }
};

// ============ HELD SALES API ============
export const heldSalesAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, held_sales: [] });

        const { data, error } = await supabase.from('held_sales').select('*').eq('company_code', companyCode).order('created_at', { ascending: false });
        return response({ success: true, held_sales: data || [] }, error);
    },
    add: async (saleData) => {
        const companyCode = getCurrentCompanyCode();
        // Format the data correctly for the database
        // Note: Using only columns that exist in the database table
        const heldSale = {
            customer_name: saleData.customer || 'Toptan Satış',
            items: saleData.items, // Supabase handles JSON automatically
            company_code: companyCode
        };
        const { data, error } = await supabase.from('held_sales').insert([heldSale]).select();
        if (error) {
            console.error('Held sale error:', error);
            throw { response: { data: { message: error.message || 'Beklemeye alma hatası' } } };
        }
        return { data: { success: true, message: 'Satış beklemeye alındı', held_sale: data?.[0] } };
    },
    delete: async (id) => {
        const { error } = await supabase.from('held_sales').delete().eq('id', id);
        return response({ success: true, message: 'Silindi' }, error);
    },
};

// ============ SHORTCUTS API ============
export const shortcutsAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, shortcuts: [] });

        const { data, error } = await supabase.from('shortcuts').select('*').eq('company_code', companyCode);
        return response({ success: true, shortcuts: data || [] }, error);
    },
    addCategory: async (name) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('shortcuts')
            .insert([{ name, items: [], company_code: companyCode }]);
        return response({ success: true, message: 'Kategori eklendi' }, error);
    },
    updateCategory: async (name, data) => {
        const companyCode = getCurrentCompanyCode();
        // Note: 'name' is unique key but id is safer? Using name as requested by existing interface
        const { error } = await supabase
            .from('shortcuts')
            .update(data)
            .eq('name', name)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Güncellendi' }, error);
    },
    deleteCategory: async (name) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('shortcuts')
            .delete()
            .eq('name', name)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Silindi' }, error);
    },
};

// ============ INVOICES API ============
export const invoicesAPI = {
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return response({ success: true, invoices: [] });

        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('company_code', companyCode)
            .order('date', { ascending: false });
        return response({ success: true, invoices: data || [] }, error);
    },
    syncBatch: async (invoices) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) throw new Error("Şirket kodu bulunamadı.");

        // Add company_code to each invoice ensuring data isolation
        const securedInvoices = invoices.map(inv => ({
            ...inv,
            company_code: companyCode
        }));

        // Upsert based on UUID or invoice_number to avoid duplicates
        const { data, error } = await supabase
            .from('invoices')
            .upsert(securedInvoices, { onConflict: 'uuid' }) // UUID + Company Code typically
            .select();

        return response({ success: true, message: `${invoices.length} fatura senkronize edildi.`, data }, error);
    },
    updateStatus: async (id, status) => {
        const companyCode = getCurrentCompanyCode();
        const { error } = await supabase
            .from('invoices')
            .update({ status })
            .eq('id', id)
            .eq('company_code', companyCode);
        return response({ success: true, message: 'Durum güncellendi' }, error);
    }
};

// ============ SETTINGS API ============
export const settingsAPI = {
    // Get a specific setting value
    get: async (key) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return { data: null };

        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .eq('company_code', companyCode)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error(`Error fetching setting ${key}:`, error);
        }

        return { data: data?.value || null };
    },

    // Save/Update a setting
    set: async (key, value) => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) throw new Error("Şirket kodu bulunamadı.");

        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: key,
                value: value,
                company_code: companyCode
            }, { onConflict: 'company_code, key' }); // Use the new composite index

        if (error) throw error;
        return { data: { success: true } };
    },

    // Get all settings for the company
    getAll: async () => {
        const companyCode = getCurrentCompanyCode();
        if (!companyCode) return { data: {} };

        const { data, error } = await supabase
            .from('app_settings')
            .select('key, value')
            .eq('company_code', companyCode);

        if (error) throw error;

        // Convert array to object { key: value }
        const settingsMap = {};
        data.forEach(item => {
            settingsMap[item.key] = item.value;
        });

        return { data: settingsMap };
    }
};

export default {
    get: async () => ({ data: {} }),
    post: async () => ({ data: {} }),
    put: async () => ({ data: {} }),
    delete: async () => ({ data: {} }),
};
