"""Exercise the local admin, merchant, and talent workflow through the real UI."""

from pathlib import Path
from re import compile as re_compile
from tempfile import gettempdir
from time import time

from playwright.sync_api import BrowserContext, Page, expect, sync_playwright


BASE_URL = "http://127.0.0.1:5182"
ADMIN_PHONE = "13000000001"
ADMIN_PASSWORD = "e2e-demo-password"
MERCHANT_PASSWORD = "e2e-merchant-password"
TALENT_PASSWORD = "e2e-talent-password"
RUN_ID = str(int(time()))[-7:]
TALENT_ALIPAY = f"e2e-{RUN_ID}@example.com"
MERCHANT_PHONE = f"151{RUN_ID:0>8}"[-11:]
TALENT_PHONE = f"152{RUN_ID:0>8}"[-11:]
ORDER_TITLE = f"E2E 春季服饰拍摄 {RUN_ID}"
COMMISSION = "66.00"
PROJECT_ROOT = Path(__file__).resolve().parent
IMAGE_ROOT = PROJECT_ROOT / "android" / "app" / "src" / "main" / "res"
AVATAR_IMAGE = IMAGE_ROOT / "drawable-port-mdpi" / "splash.png"
PORTFOLIO_IMAGES = [
    IMAGE_ROOT / "drawable-port-hdpi" / "splash.png",
    IMAGE_ROOT / "drawable-port-xhdpi" / "splash.png",
    IMAGE_ROOT / "drawable-port-xxhdpi" / "splash.png",
    IMAGE_ROOT / "drawable-port-xxxhdpi" / "splash.png",
    IMAGE_ROOT / "drawable-land-mdpi" / "splash.png",
    IMAGE_ROOT / "drawable-land-hdpi" / "splash.png",
]


def api_response(page: Page, path: str, method: str):
    return page.expect_response(lambda response: path in response.url and response.request.method == method)


def attach_diagnostics(page: Page, errors: list[str]) -> None:
    ignored_console_messages = ("Static function can not consume context like dynamic theme.",)
    page.on(
        "console",
        lambda message: errors.append(f"console: {message.text}")
        if message.type == "error" and not any(ignored in message.text for ignored in ignored_console_messages)
        else None,
    )
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.on(
        "response",
        lambda response: errors.append(f"api {response.status}: {response.url}")
        if "/api/" in response.url and response.status >= 400
        else None,
    )


def new_page(browser, errors: list[str], mobile: bool = False) -> tuple[BrowserContext, Page]:
    context = browser.new_context(
        viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 1000},
        device_scale_factor=2 if mobile else 1,
    )
    page = context.new_page()
    attach_diagnostics(page, errors)
    return context, page


def goto(page: Page, path: str) -> None:
    page.goto(f"{BASE_URL}{path}", wait_until="domcontentloaded")


def login(page: Page, path: str, phone: str, password: str, expected_path: str) -> None:
    goto(page, path)
    page.get_by_label("手机号").fill(phone)
    page.get_by_label("密码").fill(password)
    with api_response(page, "/api/auth/login", "POST") as response_info:
        page.get_by_role("button", name=re_compile("登.*录")).click()
    response = response_info.value
    assert response.status == 200, response.text()
    page.wait_for_url(f"**{expected_path}")


def open_order(page: Page, role: str, order_id: int) -> None:
    goto(page, f"/{role}/orders/{order_id}")
    expect(page.get_by_role("heading", name="订单详情")).to_be_visible()


def confirm_modal_request(page: Page, path: str, method: str) -> None:
    with api_response(page, path, method) as response_info:
        page.locator(".ant-modal-confirm .ant-btn-primary").click()
    response = response_info.value
    assert response.status == 200, response.text()


def upload_one(page: Page, image: Path, input_index: int = 0) -> None:
    with api_response(page, "/api/uploads", "POST") as response_info:
        page.locator('input[type="file"]').nth(input_index).set_input_files(str(image))
    response = response_info.value
    assert response.status == 201, response.text()


def upload_portfolio(page: Page) -> None:
    with api_response(page, "/api/uploads", "POST") as first_response:
        page.locator('input[type="file"]').nth(1).set_input_files([str(image) for image in PORTFOLIO_IMAGES])
    assert first_response.value.status == 201, first_response.value.text()
    expect(page.locator(".ant-upload-list-item-done")).to_have_count(7, timeout=30_000)


def main() -> None:
    for image in [AVATAR_IMAGE, *PORTFOLIO_IMAGES]:
        assert image.is_file(), image

    browser_errors: list[str] = []
    screenshots = Path(gettempdir())
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)

        admin_context, admin = new_page(browser, browser_errors)
        login(admin, "/admin/login", ADMIN_PHONE, ADMIN_PASSWORD, "/admin/operations")
        admin.get_by_role("button", name="新建商家").click()
        admin.get_by_label("店铺名称").fill(f"E2E 店铺 {RUN_ID}")
        admin.get_by_label("商家显示名称").fill(f"E2E 商家 {RUN_ID}")
        admin.get_by_label("电商平台").fill("本地测试平台")
        admin.get_by_label("登录手机号").fill(MERCHANT_PHONE)
        admin.get_by_label("初始密码").fill(MERCHANT_PASSWORD)
        admin.get_by_label("业务联系电话").fill(MERCHANT_PHONE)
        admin.get_by_label("默认寄样地址").fill("上海市浦东新区 E2E 路 1 号")
        with api_response(admin, "/api/admin/users/merchants", "POST") as response_info:
            admin.get_by_role("button", name="确认创建").click()
        merchant_response = response_info.value
        assert merchant_response.status == 201, merchant_response.text()
        expect(admin.get_by_text("商家已创建并选中")).to_be_visible()

        admin.get_by_role("button", name="发布订单").click()
        category_select = admin.locator(".ant-form-item").filter(has_text="商品分类").locator(".ant-select-selector")
        category_select.click()
        admin.locator(".ant-select-dropdown:visible .ant-select-item-option", has_text="服饰穿搭").click()
        admin.locator(".ant-form-item").filter(has_text="订单标题").get_by_role("textbox").fill(ORDER_TITLE)
        admin.get_by_label("拍摄说明").fill("验证管理员代商家发布、达人申请和素材交付的完整本地流程。")
        upload_one(admin, AVATAR_IMAGE)
        admin.get_by_label("佣金").fill(COMMISSION)
        admin.get_by_label("交付要求").fill("提供 6 张以上清晰服饰展示图片。")
        with api_response(admin, "/api/admin/orders", "POST") as response_info:
            admin.get_by_role("button", name="确认发布").click()
        order_response = response_info.value
        assert order_response.status == 201, order_response.text()
        order_id = order_response.json()["data"]["id"]
        expect(admin.get_by_text("订单已按所选商家归属发布")).to_be_visible()
        expect(admin.locator(".ant-modal:visible")).to_have_count(0)
        admin.screenshot(path=str(screenshots / "lanying-e2e-admin-published.png"), full_page=True)
        admin_context.close()

        talent_context, talent = new_page(browser, browser_errors)
        goto(talent, "/talent/register")
        talent.get_by_label("手机号").fill(TALENT_PHONE)
        talent.get_by_label("密码").fill(TALENT_PASSWORD)
        with api_response(talent, "/api/auth/register", "POST") as response_info:
            talent.get_by_role("button", name="创建账号").click()
        assert response_info.value.status == 201, response_info.value.text()
        talent.wait_for_url("**/model/onboarding")
        talent.wait_for_load_state("networkidle")
        upload_one(talent, AVATAR_IMAGE)
        talent.get_by_label("用户名").fill(f"E2E 达人 {RUN_ID}")
        talent.get_by_label("身高（cm）").fill("168")
        talent.get_by_label("体重（kg）").fill("50")
        talent.get_by_label("技能标签").fill("平面模特、服饰拍摄")
        talent.locator("#receive_address").click()
        talent.locator(".ant-cascader-menu-item").filter(has_text="上海市").first.click()
        talent.locator(".ant-cascader-menu-item").filter(has_text="上海市").last.click()
        talent.locator(".ant-cascader-menu-item").filter(has_text="浦东新区").click()
        talent.get_by_label("收件人姓名").fill("测试达人")
        talent.get_by_label("收件人手机号").fill(TALENT_PHONE)
        talent.get_by_label("详细收货地址").fill("E2E 花园 1 栋 101 室")
        upload_portfolio(talent)
        with api_response(talent, "/api/users/me", "PUT") as response_info:
            talent.get_by_role("button", name="下一步：实名认证").click()
        assert response_info.value.status == 200, response_info.value.text()
        talent.wait_for_url("**/model/onboarding/verify")
        talent.get_by_label("真实姓名").fill("测试达人")
        talent.get_by_label("身份证号").fill("110101199001011234")
        talent.get_by_label("支付宝账号").fill(TALENT_ALIPAY)
        talent.get_by_label("支付宝实名").fill("测试达人")
        with api_response(talent, "/api/users/me/verify", "POST") as response_info:
            talent.get_by_role("button", name="提交实名认证").click()
        assert response_info.value.status == 200, response_info.value.text()
        talent.wait_for_url("**/model/hall")
        talent_context.close()

        admin_context, admin = new_page(browser, browser_errors)
        login(admin, "/admin/login", ADMIN_PHONE, ADMIN_PASSWORD, "/admin/operations")
        goto(admin, "/admin/users")
        admin.get_by_placeholder("手机号或昵称").fill(TALENT_PHONE)
        admin.get_by_placeholder("手机号或昵称").press("Enter")
        expect(admin.get_by_text(TALENT_PHONE)).to_be_visible()
        admin.get_by_role("button", name="审核认证").click()
        with api_response(admin, "/api/admin/users/", "PUT") as response_info:
            admin.get_by_role("button", name="确认审核").click()
        assert response_info.value.status == 200, response_info.value.text()
        admin_context.close()

        talent_context, talent = new_page(browser, browser_errors)
        login(talent, "/talent/login", TALENT_PHONE, TALENT_PASSWORD, "/model/hall")
        expect(talent.get_by_text(ORDER_TITLE)).to_be_visible()
        talent.get_by_role("article").filter(has_text=ORDER_TITLE).get_by_role("button", name="查看详情并申请").click()
        talent.wait_for_url(f"**/model/hall/{order_id}")
        talent.get_by_role("button", name="提交接单申请").click()
        talent.get_by_role("textbox").last.fill("档期充足，可在要求时限内完成服饰平拍。")
        with api_response(talent, f"/api/orders/{order_id}/applications", "POST") as response_info:
            talent.get_by_role("button", name="确认申请").click()
        assert response_info.value.status == 201, response_info.value.text()
        expect(talent.get_by_text("申请已提交", exact=True)).to_be_visible()
        expect(talent.locator(".ant-modal:visible")).to_have_count(0)
        talent.screenshot(path=str(screenshots / "lanying-e2e-talent-application.png"), full_page=True)
        talent_context.close()

        admin_context, admin = new_page(browser, browser_errors)
        login(admin, "/admin/login", ADMIN_PHONE, ADMIN_PASSWORD, "/admin/operations")
        goto(admin, "/admin/applications")
        expect(admin.get_by_text(ORDER_TITLE)).to_be_visible()
        admin.locator("tr").filter(has_text=ORDER_TITLE).get_by_role("button").click()
        with api_response(admin, "/api/admin/order-applications/", "PUT") as response_info:
            admin.get_by_role("button", name="通过并分配").click()
        assert response_info.value.status == 200, response_info.value.text()
        admin_context.close()

        merchant_context, merchant = new_page(browser, browser_errors)
        login(merchant, "/login", MERCHANT_PHONE, MERCHANT_PASSWORD, "/merchant/orders")
        open_order(merchant, "merchant", order_id)
        merchant.get_by_role("button", name="填写寄样物流").click()
        merchant.get_by_label("物流公司").fill("顺丰速运")
        merchant.get_by_label("物流单号").fill(f"SF{RUN_ID}01")
        with api_response(merchant, f"/api/orders/{order_id}/ship", "PUT") as response_info:
            merchant.get_by_role("button", name="确认提交").click()
        assert response_info.value.status == 200, response_info.value.text()
        merchant_context.close()

        talent_context, talent = new_page(browser, browser_errors)
        login(talent, "/talent/login", TALENT_PHONE, TALENT_PASSWORD, "/model/hall")
        open_order(talent, "model", order_id)
        talent.get_by_role("button", name="确认收货").click()
        confirm_modal_request(talent, f"/api/orders/{order_id}/receive", "PUT")
        talent.get_by_role("button", name="提交素材并回寄").click()
        upload_one(talent, PORTFOLIO_IMAGES[0])
        talent.get_by_label("物流公司").fill("顺丰速运")
        talent.get_by_label("物流单号").fill(f"SF{RUN_ID}02")
        with api_response(talent, f"/api/orders/{order_id}/submit", "PUT") as response_info:
            talent.get_by_role("button", name="确认提交").click()
        assert response_info.value.status == 200, response_info.value.text()
        talent_context.close()

        merchant_context, merchant = new_page(browser, browser_errors)
        login(merchant, "/login", MERCHANT_PHONE, MERCHANT_PASSWORD, "/merchant/orders")
        open_order(merchant, "merchant", order_id)
        merchant.get_by_role("button", name="验收通过").click()
        confirm_modal_request(merchant, f"/api/orders/{order_id}/accept", "PUT")
        merchant_context.close()

        talent_context, talent = new_page(browser, browser_errors)
        login(talent, "/talent/login", TALENT_PHONE, TALENT_PASSWORD, "/model/hall")
        goto(talent, "/model/wallet")
        expect(talent.locator(".wallet-summary-card--available strong", has_text=COMMISSION)).to_be_visible()
        talent.get_by_role("button", name="申请提现").click()
        talent.get_by_label("提现金额").fill(COMMISSION)
        with api_response(talent, "/api/withdrawals", "POST") as response_info:
            talent.get_by_role("button", name="提交申请").click()
        assert response_info.value.status == 201, response_info.value.text()
        talent.wait_for_url("**/model/wallet")
        expect(talent.get_by_text("待审核")).to_be_visible()
        talent_context.close()

        admin_context, admin = new_page(browser, browser_errors)
        login(admin, "/admin/login", ADMIN_PHONE, ADMIN_PASSWORD, "/admin/operations")
        goto(admin, "/admin/withdrawals")
        admin.locator("tr").filter(has_text=TALENT_ALIPAY).get_by_role("button").first.click()
        with api_response(admin, "/api/admin/withdrawals/", "PUT") as response_info:
            admin.locator(".ant-modal-confirm .ant-btn-primary").click()
        assert response_info.value.status == 200, response_info.value.text()
        admin.get_by_role("tab", name="待转账").click()
        admin.locator("tr").filter(has_text=TALENT_ALIPAY).get_by_role("button").click()
        admin.get_by_label("支付宝转账流水号").fill(f"ALIPAY{RUN_ID}")
        with api_response(admin, "/api/admin/withdrawals/", "PUT") as response_info:
            admin.locator(".ant-modal:visible button[type='submit']").click()
        assert response_info.value.status == 200, response_info.value.text()
        expect(admin.get_by_text("操作成功")).to_be_visible()
        admin_context.close()

        mobile_context, mobile = new_page(browser, browser_errors, mobile=True)
        login(mobile, "/talent/login", TALENT_PHONE, TALENT_PASSWORD, "/model/hall")
        expect(mobile.get_by_role("navigation", name="达人导航")).to_be_visible()
        expect(mobile.get_by_role("navigation", name="达人导航").get_by_role("button")).to_have_count(5)
        mobile.screenshot(path=str(screenshots / "lanying-e2e-talent-mobile.png"), full_page=True)
        mobile_context.close()
        browser.close()

    assert not browser_errors, "\n".join(browser_errors)
    print(f"E2E flow passed: order={order_id}, merchant={MERCHANT_PHONE}, talent={TALENT_PHONE}")


if __name__ == "__main__":
    main()
