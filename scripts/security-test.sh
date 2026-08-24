#!/usr/bin/env bash

set -u

# ============================================================
# Security Test Suite
# NestJS API
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:3000/api/v1}"
COUNTRIES_URL="${BASE_URL}/countries"

COOKIE_FILE="${COOKIE_FILE:-cookies.txt}"

PASS=0
FAIL=0

# ============================================================
# Helpers
# ============================================================

print_header() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

pass() {
  echo "  [PASS] $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  [FAIL] $1"
  FAIL=$((FAIL + 1))
}

assert_status() {
  local description="$1"
  local expected="$2"
  local actual="$3"

  if [[ "$actual" == "$expected" ]]; then
    pass "${description} → HTTP ${actual}"
  else
    fail "${description} → expected HTTP ${expected}, got HTTP ${actual}"
  fi
}

cleanup() {
  rm -f "${COOKIE_FILE}"
}

trap cleanup EXIT

# ============================================================
# Pre-flight
# ============================================================

print_header "Security Test Suite"

echo "Base URL : ${BASE_URL}"
echo "Target   : ${COUNTRIES_URL}"
echo

if ! command -v curl >/dev/null 2>&1; then
  echo "[ERROR] curl is not installed."
  exit 1
fi

if ! curl -s --connect-timeout 3 "${COUNTRIES_URL}" >/dev/null 2>&1; then
  echo "[ERROR] API is not reachable at ${COUNTRIES_URL}"
  echo
  echo "Make sure NestJS is running first."
  exit 1
fi

# ============================================================
# 1. SQL Injection
# ============================================================

print_header "1. SQL Injection"

SQL_INJECTION_STATUS=$(
  curl -s \
    -o /dev/null \
    -w "%{http_code}" \
    -X POST "${COUNTRIES_URL}" \
    -H "Content-Type: application/json" \
    -d '{"name":"1 OR 1=1"}'
)

assert_status \
  "SQL Injection payload" \
  "403" \
  "${SQL_INJECTION_STATUS}"

# ============================================================
# 2. XSS via Query Parameter
# ============================================================

print_header "2. XSS via Query Parameter"

XSS_QUERY_STATUS=$(
  curl -s \
    -o /dev/null \
    -w "%{http_code}" \
    --get "${COUNTRIES_URL}" \
    --data-urlencode 'name=<script>alert(1)</script>'
)

assert_status \
  "XSS query parameter" \
  "403" \
  "${XSS_QUERY_STATUS}"

# ============================================================
# 3. Path Traversal
# ============================================================

print_header "3. Path Traversal"

PATH_TRAVERSAL_STATUS=$(
  curl -s \
    -o /dev/null \
    -w "%{http_code}" \
    --path-as-is \
    "${COUNTRIES_URL}/../../../etc/passwd"
)

assert_status \
  "Path Traversal payload" \
  "403" \
  "${PATH_TRAVERSAL_STATUS}"

# ============================================================
# 4. XSRF / CSRF Protection
# ============================================================

print_header "4. XSRF / CSRF Protection"

rm -f "${COOKIE_FILE}"

echo "  Getting CSRF token..."

CSRF_RESPONSE_FILE="$(mktemp)"

CSRF_STATUS=$(
  curl -s \
    -o "${CSRF_RESPONSE_FILE}" \
    -w "%{http_code}" \
    -c "${COOKIE_FILE}" \
    "${BASE_URL}/auth/csrf"
)

assert_status \
  "GET /auth/csrf" \
  "200" \
  "${CSRF_STATUS}"

if [[ "${CSRF_STATUS}" == "200" ]]; then

  CSRF_TOKEN=$(
    python3 -c '
import json
import sys

try:
    with open(sys.argv[1], "r") as file:
        data = json.load(file)

    token = data.get("data", {}).get("csrfToken", "")

    print(token)

except Exception:
    print("")
' "${CSRF_RESPONSE_FILE}"
  )

else

  CSRF_TOKEN=""

fi

rm -f "${CSRF_RESPONSE_FILE}"

if [[ -n "${CSRF_TOKEN}" ]]; then

  pass "GET /auth/csrf returns CSRF token"

else

  fail "GET /auth/csrf returns CSRF token"

fi

# ============================================================
# 5. POST Without XSRF Header
# ============================================================

print_header "5. XSRF Request Without Header"

XSRF_MISSING_HEADER_STATUS=$(
  curl -s \
    -o /dev/null \
    -w "%{http_code}" \
    -X POST "${COUNTRIES_URL}" \
    -b "${COOKIE_FILE}" \
    -H "Content-Type: application/json" \
    -d '{"name":"Indonesia"}'
)

assert_status \
  "POST without XSRF header" \
  "403" \
  "${XSRF_MISSING_HEADER_STATUS}"

# ============================================================
# 6. XSRF Request With Header
# ============================================================

print_header "6. XSRF Request With Header"

TOKEN="${CSRF_TOKEN:-}"

if [[ -z "${TOKEN}" ]]; then

  fail "CSRF token is unavailable"

else

  pass "CSRF token extracted from /auth/csrf response"

  XSRF_VALID_RESPONSE_FILE="$(mktemp)"

  XSRF_VALID_STATUS=$(
    curl -s \
      -o "${XSRF_VALID_RESPONSE_FILE}" \
      -w "%{http_code}" \
      -X POST "${COUNTRIES_URL}" \
      -b "${COOKIE_FILE}" \
      -H "Content-Type: application/json" \
      -H "x-xsrf-token: ${TOKEN}" \
      -d '{
        "code": "ZZ",
        "iso2": "ZZ",
        "iso3": "ZZZ"
      }'
  )

  XSRF_VALID_RESPONSE=$(cat "${XSRF_VALID_RESPONSE_FILE}")

  rm -f "${XSRF_VALID_RESPONSE_FILE}"

  if [[ "${XSRF_VALID_STATUS}" != "403" ]]; then

    pass "POST with valid XSRF header accepted by CSRF layer → HTTP ${XSRF_VALID_STATUS}"

  else

    fail "POST with valid XSRF header was rejected by CSRF layer → HTTP 403"

    echo
    echo "  Response:"
    echo "  ${XSRF_VALID_RESPONSE}"

  fi

fi

# ============================================================
# 7. Security Headers
# ============================================================

print_header "7. Security Headers"

HEADERS=$(
  curl -s \
    -I \
    "${COUNTRIES_URL}"
)

echo "${HEADERS}"

echo

if echo "${HEADERS}" | grep -qi "^x-content-type-options:"; then
  pass "X-Content-Type-Options header exists"
else
  fail "X-Content-Type-Options header exists"
fi

if echo "${HEADERS}" | grep -qi "^x-frame-options:"; then
  pass "X-Frame-Options header exists"
else
  fail "X-Frame-Options header exists"
fi

if echo "${HEADERS}" | grep -qi "^content-security-policy:"; then
  pass "Content-Security-Policy header exists"
else
  fail "Content-Security-Policy header exists"
fi

# ============================================================
# 8. XSS Payload in Request Body
# ============================================================

print_header "8. XSS Payload in Request Body"

if [[ -z "${TOKEN}" ]]; then

  fail "XSS body test skipped because XSRF token is unavailable"

else

  XSS_PAYLOAD='{
    "code": "X9",
    "name": "<script>alert(1)</script>",
    "iso2": "X9",
    "iso3": "X99"
  }'

  XSS_RESPONSE_FILE="$(mktemp)"

  XSS_STATUS=$(
    curl -s \
      -o "${XSS_RESPONSE_FILE}" \
      -w "%{http_code}" \
      -X POST "${COUNTRIES_URL}" \
      -b "${COOKIE_FILE}" \
      -H "Content-Type: application/json" \
      -H "x-xsrf-token: ${TOKEN}" \
      -d "${XSS_PAYLOAD}"
  )

  XSS_BODY=$(cat "${XSS_RESPONSE_FILE}")

  rm -f "${XSS_RESPONSE_FILE}"

  echo "HTTP Status: ${XSS_STATUS}"

  echo
  echo "Response:"
  echo "${XSS_BODY}"

  echo

  XSS_RAW_FOUND=$(
    printf '%s' "${XSS_BODY}" |
      python3 -c '
import json
import sys

try:
    data = json.load(sys.stdin)

    raw_payload = "<script>alert(1)</script>"

    response_text = json.dumps(data)

    if raw_payload in response_text:
        print("true")
    else:
        print("false")

except Exception:
    print("false")
'
  )

  if [[ "${XSS_RAW_FOUND}" == "true" ]]; then

    fail "XSS body payload is returned as raw executable markup"

  else

    pass "XSS body payload is not returned as raw executable markup"

  fi

fi

# ============================================================
# 9. Rate Limiting
# ============================================================

print_header "9. Rate Limiting"

echo "  Sending 15 requests..."
echo

RATE_LIMIT_TRIGGERED=false
RATE_LIMIT_FIRST_REQUEST=0

for i in {1..15}; do

  STATUS=$(
    curl -s \
      -o /dev/null \
      -w "%{http_code}" \
      "${COUNTRIES_URL}"
  )

  echo "  Request ${i}: HTTP ${STATUS}"

  if [[ "${STATUS}" == "429" && "${RATE_LIMIT_TRIGGERED}" == false ]]; then
    RATE_LIMIT_TRIGGERED=true
    RATE_LIMIT_FIRST_REQUEST="${i}"
  fi

done

echo

if [[ "${RATE_LIMIT_TRIGGERED}" == true ]]; then

  pass "Rate limiting triggered at request ${RATE_LIMIT_FIRST_REQUEST}"

else

  fail "Rate limiting was not triggered after 15 requests"

fi

# ============================================================
# Summary
# ============================================================

print_header "Test Summary"

TOTAL=$((PASS + FAIL))

echo "Total : ${TOTAL}"
echo "Pass  : ${PASS}"
echo "Fail  : ${FAIL}"
echo

if [[ "${FAIL}" -eq 0 ]]; then

  echo "ALL SECURITY TESTS PASSED."
  exit 0

else

  echo "SECURITY TESTS FAILED."
  exit 1

fi