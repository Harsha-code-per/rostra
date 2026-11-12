from app.services.payroll_service import calculate_salary_structure, calculate_payable_payout


def test_salary_structure_formula_50k():
    res = calculate_salary_structure(50000.0)
    assert res["wage"] == 50000.0
    assert res["basic"] == 25000.0  # 50% of 50,000
    assert res["hra"] == 12500.0    # 50% of 25,000
    assert res["standard_allowance"] == 4167.0
    assert res["performance_bonus"] == 2082.5  # 8.33% of 25,000
    assert res["lta"] == 2082.5                # 8.33% of 25,000
    assert res["pf"] == 3000.0                 # 12% of 25,000
    assert res["professional_tax"] == 200.0
    assert res["gross_salary"] == 50000.0
    assert res["total_deductions"] == 3200.0
    assert res["net_salary"] == 46800.0


def test_salary_structure_formula_60k():
    res = calculate_salary_structure(60000.0)
    assert res["wage"] == 60000.0
    assert res["basic"] == 30000.0
    assert res["hra"] == 15000.0
    assert res["pf"] == 3600.0
    assert res["professional_tax"] == 200.0
    assert res["total_deductions"] == 3800.0
    assert res["net_salary"] == 56200.0


def test_salary_structure_formula_75k():
    res = calculate_salary_structure(75000.0)
    assert res["wage"] == 75000.0
    assert res["basic"] == 37500.0
    assert res["hra"] == 18750.0
    assert res["standard_allowance"] == 4167.0
    assert res["performance_bonus"] == 3123.75
    assert res["lta"] == 3123.75
    assert res["pf"] == 4500.0
    assert res["professional_tax"] == 200.0
    assert res["total_deductions"] == 4700.0
    assert res["net_salary"] == 70300.0


def test_salary_structure_formula_90k():
    res = calculate_salary_structure(90000.0)
    assert res["wage"] == 90000.0
    assert res["basic"] == 45000.0
    assert res["hra"] == 22500.0
    assert res["pf"] == 5400.0
    assert res["professional_tax"] == 200.0
    assert res["total_deductions"] == 5600.0
    assert res["net_salary"] == 84400.0


def test_payable_days_payout_full():
    res = calculate_payable_payout(net_salary=70300.0, total_working_days=22, present_days=20, paid_leave_days=2)
    assert res["payable_days"] == 22.0
    assert res["unpaid_days"] == 0.0
    assert res["effective_net_payout"] == 70300.0


def test_payable_days_payout_with_unpaid():
    res = calculate_payable_payout(net_salary=70300.0, total_working_days=22, present_days=19.5, paid_leave_days=2)
    assert res["payable_days"] == 21.5
    assert res["unpaid_days"] == 0.5
    # 70300 * (21.5 / 22) = 68702.27
    assert res["effective_net_payout"] == 68702.27
