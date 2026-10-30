/* ProMouser Online: Supabase connection.
   Use the SAME project URL and publishable key as ProMouser's supabase-config.js, so
   both sites share accounts. Leave empty to run in local demo mode.
   These two values are public by design. Never put the service_role / secret key here. */
window.PMO_SUPABASE = {
  url: '',
  anonKey: '',
  testPayments: true   // the demo checkout grants purchases; set false once Razorpay is live
};
