import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000/api/v1"

def make_request(url, method="GET", data=None, token=None):
    req_url = f"{BASE_URL}{url}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(req_url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            err_detail = json.loads(body)
        except:
            err_detail = body
        print(f"HTTP Error {e.code} on {method} {url}: {err_detail}")
        raise e


def test_entire_system_flow():
    print("--- 1. Seeding Demo Users ---")
    status, seed_res = make_request("/admin/seed", "POST")
    print(f"Seed Response: {seed_res['message']}")
    
    print("\n--- 2. Logging in as Employee (John Doe) ---")
    status, login_res = make_request("/auth/login", "POST", {
        "email": "john.doe@company.com",
        "password": "employee123"
    })
    emp_token = login_res["access_token"]
    print(f"Logged in. Employee Name: {login_res['user']['full_name']}")
    
    print("\n--- 3. Submitting Leave Request (John Doe) ---")
    status, leave_res = make_request("/leaves/", "POST", {
        "leave_type": "annual",
        "start_date": "2026-09-10",
        "end_date": "2026-09-12",
        "reason": "Planned vacation"
    }, token=emp_token)
    leave_id = leave_res["id"]
    print(f"Submitted Leave Request ID: {leave_id}, Status: {leave_res['status']}, Days: {leave_res['total_days']}")
    
    print("\n--- 4. Logging in as Manager (Sarah Manager) ---")
    status, mgr_login_res = make_request("/auth/login", "POST", {
        "email": "sarah.manager@company.com",
        "password": "manager123"
    })
    mgr_token = mgr_login_res["access_token"]
    print(f"Logged in. Manager Name: {mgr_login_res['user']['full_name']}")
    
    print("\n--- 5. Checking Pending Approvals (Manager) ---")
    status, pending_res = make_request("/leaves/team/pending", "GET", token=mgr_token)
    pending_items = pending_res["items"]
    print(f"Pending Requests count: {pending_res['total']}")
    
    # Find our leave request in manager pending approvals.
    match = [r for r in pending_items if r["id"] == leave_id]
    assert len(match) == 1, "Pending request must be visible to manager"
    print(f"Found request in Manager list. Reason: {match[0]['reason']}")
    
    print("\n--- 6. Approving Request (Manager) ---")
    status, review_res = make_request(f"/leaves/{leave_id}/approve", "PATCH", {
        "remarks": "Approved. Enjoy your time off!"
    }, token=mgr_token)
    print(f"Approval Success. Status is now: {review_res['status']}")
    
    print("\n--- 7. Logging in as HR (Helen HR) ---")
    status, hr_login_res = make_request("/auth/login", "POST", {
        "email": "helen.hr@company.com",
        "password": "hr123"
    })
    hr_token = hr_login_res["access_token"]
    print(f"Logged in. HR Name: {hr_login_res['user']['full_name']}")
    
    print("\n--- 8. Fetching HR Dashboard Leave Statistics ---")
    status, stats_res = make_request("/hr/statistics", "GET", token=hr_token)
    print(f"HR Stats: Employees: {stats_res['total_employees']}, Managers: {stats_res['total_managers']}, Approved requests: {stats_res['approved_requests']}")
    
    print("\n--- 9. Fetching HR Paginated Organizational Leaves ---")
    status, hr_leaves_res = make_request("/hr/leaves", "GET", token=hr_token)
    print(f"HR Leaves Total: {hr_leaves_res['total']}")
    hr_match = [r for r in hr_leaves_res["items"] if r["id"] == leave_id]
    assert len(hr_match) == 1, "Approved request must be visible in organizational logs for HR"
    print(f"HR verified request details: Employee: {hr_match[0]['employee_name']}, Status: {hr_match[0]['status']}")
    
    print("\n--- 10. Checking Notification & Final Balance (John Doe) ---")
    status, emp_profile_res = make_request("/auth/me", "GET", token=emp_token)
    print(f"Remaining Annual Leave Days: {emp_profile_res['leave_balances']['annual']}")
    assert emp_profile_res['leave_balances']['annual'] < 20, "Leave days must be deducted"
    
    status, notif_res = make_request("/notifications/", "GET", token=emp_token)
    unread_notifs = [n for n in notif_res["items"] if not n["is_read"]]
    print(f"Unread Notifications: {len(unread_notifs)}")
    if unread_notifs:
        print(f"Latest Notification Message: {unread_notifs[0]['message']}")
    
    print("\nSUCCESS: End-to-end programmatic verification flow complete!")

if __name__ == "__main__":
    try:
        test_entire_system_flow()
    except Exception as e:
        print(f"\nFLOW VERIFICATION FAILED: {e}")
