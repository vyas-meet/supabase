// [TODO] I'm guessing this should come from the API?
export interface SubscriptionPreview {
  // Amount due total
  amount_due: number
  // Amount due total - available credit balance
  amount_due_immediately: number
  // Amount of credit the org has left
  available_credit_balance: number
  // Remaining credit balance after deducting to amount due immediately
  remaining_credit_balance: number
  // Amount of credits returned as refund from a downgrade
  returned_credits: number
  // Amount due for each subsequent month
  base_amount_due_next_billing_cycle: number
  // Date for next invoice (Billing cycle resets for every change to a subscription)
  next_billing_cycle: number
  // Remaining number of days to end of current billing cycle
  // This is meant for FE to display the refund specifics
  remaining_days_in_current_billing_cycle: number
  // Total days in current billing cycle
  // This is meant for FE to display the refund specifics
  total_days_in_current_billing_cycle: number
}
