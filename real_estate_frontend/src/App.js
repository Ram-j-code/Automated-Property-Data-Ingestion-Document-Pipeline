import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

/**
 * -------------------- CONFIG / CONSTANTS --------------------
 * Drop-in: uses REACT_APP_API_BASE if provided, otherwise defaults to localhost.
 */
const API_BASE = (process.env.REACT_APP_API_BASE || 'http://127.0.0.1:5000').replace(/\/$/, '');

const STATE_OPTIONS = [
  { code: 'TN', label: 'Tennessee' },
  { code: 'GA', label: 'Georgia' },
  { code: 'VA', label: 'Virginia' },
];

const COUNTY_OPTIONS = {
  TN: [
    'Anderson County, TN',
    'Bedford County, TN',
    'Benton County, TN',
    'Bledsoe County, TN',
    'Blount County, TN',
    'Bradley County, TN',
    'Campbell County, TN',
    'Cannon County, TN',
    'Carroll County, TN',
    'Carter County, TN',
    'Cheatham County, TN',
    'Chester County, TN',
    'Claiborne County, TN',
    'Clay County, TN',
    'Cocke County, TN',
    'Coffee County, TN',
    'Crockett County, TN',
    'Cumberland County, TN',
    'Davidson County, TN',
    'Decatur County, TN',
    'Dekalb County, TN',
    'Dickson County, TN',
    'Dyer County, TN',
    'Fayette County, TN',
    'Fentress County, TN',
    'Franklin County, TN',
    'Gibson County, TN',
    'Giles County, TN',
    'Grainger County, TN',
    'Greene County, TN',
    'Grundy County, TN',
    'Hamblen County, TN',
    'Hamilton County, TN',
    'Hancock County, TN',
    'Hardeman County, TN',
    'Hardin County, TN',
    'Hawkins County, TN',
    'Haywood County, TN',
    'Henderson County, TN',
    'Henry County, TN',
    'Hickman County, TN',
    'Houston County, TN',
    'Humphreys County, TN',
    'Jackson County, TN',
    'Jefferson County, TN',
    'Johnson County, TN',
    'Knox County, TN',
    'Lake County, TN',
    'Lauderdale County, TN',
    'Lawrence County, TN',
    'Lewis County, TN',
    'Lincoln County, TN',
    'Loudon County, TN',
    'Macon County, TN',
    'Madison County, TN',
    'Marion County, TN',
    'Marshall County, TN',
    'Maury County, TN',
    'McMinn County, TN',
    'McNairy County, TN',
    'Meigs County, TN',
    'Monroe County, TN',
    'Montgomery County, TN',
    'Moore County, TN',
    'Morgan County, TN',
    'Obion County, TN',
    'Overton County, TN',
    'Perry County, TN',
    'Pickett County, TN',
    'Polk County, TN',
    'Putnam County, TN',
    'Rhea County, TN',
    'Roane County, TN',
    'Robertson County, TN',
    'Rutherford County, TN',
    'Scott County, TN',
    'Sequatchie County, TN',
    'Sevier County, TN',
    'Shelby County, TN',
    'Smith County, TN',
    'Stewart County, TN',
    'Sullivan County, TN',
    'Sumner County, TN',
    'Tipton County, TN',
    'Trousdale County, TN',
    'Unicoi County, TN',
    'Union County, TN',
    'Van Buren County, TN',
    'Warren County, TN',
    'Washington County, TN',
    'Wayne County, TN',
    'Weakley County, TN',
    'White County, TN',
    'Williamson County, TN',
    'Wilson County, TN',
  ],
  GA: [
    'Catoosa County, GA',
    'Chattooga County, GA',
    'Dade County, GA',
    'Murray County, GA',
    'Walker County, GA',
    'Whitfield County, GA',
  ],
  VA: [
    'Bristill City, VA',
    'Lee County, VA',
    'Scott County, VA',
    'Smyth County, VA',
    'Washington County, VA',
    'Wise County, VA',
  ],
};

const SESSION_KEY = 'thg_session_v1';

/**
 * -------------------- API CLIENT --------------------
 * - Centralized fetch wrapper
 * - Timeout + abort support
 * - Better errors (shows server JSON message if present)
 * - Optional auth header (token)
 */
function makeApiClient(getToken) {
  async function request(path, { method = 'GET', body, headers, signal, timeoutMs = 45000 } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Allow caller abort + our timeout abort
    const compositeSignal = anySignal(signal, controller.signal);

    const token = getToken?.();
    const finalHeaders = {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    };

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: finalHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: compositeSignal,
      });

      const contentType = res.headers.get('Content-Type') || '';
      const isJson = contentType.includes('application/json');

      // Parse error details if possible
      if (!res.ok) {
        let msg = `Request failed (${res.status})`;
        try {
          const err = isJson ? await res.json() : await res.text();
          if (typeof err === 'string' && err.trim()) msg = err;
          if (err && typeof err === 'object' && (err.message || err.error))
            msg = err.message || err.error;
        } catch {
          // ignore parse failure
        }
        const e = new Error(msg);
        e.status = res.status;
        throw e;
      }

      return res;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    postJson: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
    get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  };
}

// Helper: combine multiple abort signals
function anySignal(...signals) {
  const valid = signals.filter(Boolean);
  if (valid.length <= 1) return valid[0];

  const controller = new AbortController();
  const onAbort = () => controller.abort();

  valid.forEach(s => {
    if (s.aborted) controller.abort();
    else s.addEventListener('abort', onAbort, { once: true });
  });

  return controller.signal;
}

/**
 * -------------------- SMALL UI HELPERS --------------------
 */
function InlineStatus({ type = 'info', message }) {
  if (!message) return null;
  const styles =
    type === 'error'
      ? 'border-red-500/40 text-red-200'
      : type === 'success'
      ? 'border-green-500/40 text-green-200'
      : 'border-yellow-600/40 text-yellow-200';

  return <div className={`p-2 bg-black/40 border rounded-md text-sm ${styles}`}>{message}</div>;
}

function clampPercentString(v) {
  // Keep as string for controlled input, but enforce numeric bounds when validating.
  return String(v ?? '').replace(/[^\d.]/g, '');
}

function toNumberSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * -------------------- MAIN APP --------------------
 */
function App() {
  // Session-persisted auth (drop-in: still supports old backend that only returns success + user)
  const [auth, setAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [token, setToken] = useState(''); // optional if backend supports it

  // LOGIN STATE
  const [showLogin, setShowLogin] = useState(false);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // WIZARD STEP
  const [step, setStep] = useState(1);

  // FORM STATES
  const [name, setName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [address, setAddress] = useState('');
  const [stateCode, setStateCode] = useState('TN');
  const [county, setCounty] = useState('Shelby County, TN');
  const [propertyUnderAppraisal, setPropertyUnderAppraisal] = useState('');
  const [parcel, setParcel] = useState('');
  const [fee, setFee] = useState('');
  const [dueSigning, setDueSigning] = useState('50');
  const [dueCompletion, setDueCompletion] = useState('50');
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Generated artifact state
  const [generatedPdfPath, setGeneratedPdfPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingParcel, setFetchingParcel] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Status messages (more production-friendly than alert spam)
  const [globalStatus, setGlobalStatus] = useState({ type: 'info', message: '' });
  const [emailStatus, setEmailStatus] = useState('');

  // Abort controllers (avoid race conditions + stale updates)
  const fetchParcelAbortRef = useRef(null);
  const generateAbortRef = useRef(null);

  const api = useMemo(() => makeApiClient(() => token), [token]);

  const countyList = useMemo(() => COUNTY_OPTIONS[stateCode] || [], [stateCode]);

  // Restore session on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s?.auth && s?.currentUser) {
        setAuth(true);
        setCurrentUser(s.currentUser);
        if (s.token) setToken(s.token);
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist session when auth changes
  useEffect(() => {
    const payload = { auth, currentUser, token };
    try {
      if (auth) sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, [auth, currentUser, token]);

  // Update county when state changes (and keep county consistent)
  useEffect(() => {
    if (!countyList.length) {
      setCounty('');
      return;
    }
    if (!countyList.includes(county)) setCounty(countyList[0]);
  }, [countyList, county]);

  const setStatus = (type, message) => setGlobalStatus({ type, message });

  // LOGIN
  const handleLogin = async e => {
    e.preventDefault();
    setLoginError('');
    setStatus('info', '');

    try {
      const res = await api.postJson('/login', { username: loginUser, password: loginPass });
      const data = await res.json();

      if (data?.success) {
        setAuth(true);
        setCurrentUser(data.user || loginUser);
        setToken(data.token || ''); // backward compatible
        setShowLogin(false);
        setStep(1);
      } else {
        setLoginError('Invalid username or password.');
      }
    } catch (err) {
      setLoginError(err?.message || 'Server error.');
    }
  };

  // FETCH PARCEL
  const handleFetchParcel = async () => {
    if (!address || !county) {
      setStatus('error', 'Enter address and county.');
      return;
    }

    // Cancel previous in-flight request to prevent race/stale parcel updates
    if (fetchParcelAbortRef.current) fetchParcelAbortRef.current.abort();
    const controller = new AbortController();
    fetchParcelAbortRef.current = controller;

    setFetchingParcel(true);
    setStatus('info', 'Fetching parcel…');

    try {
      const res = await api.postJson(
        '/fetch_parcel_ui',
        { full_address: address, county_name: county },
        { signal: controller.signal, timeoutMs: 60000 }
      );

      const data = await res.json();
      if (!data?.parcel_id) throw new Error('Parcel not found.');
      setParcel(data.parcel_id);
      setStatus('success', 'Parcel fetched successfully.');
    } catch (err) {
      if (err?.name === 'AbortError') return; // user initiated / new request
      setStatus('error', err?.message || 'Bot error.');
    } finally {
      setFetchingParcel(false);
    }
  };

  // Validations
  const feeNum = toNumberSafe(fee);
  const dueSigningNum = toNumberSafe(dueSigning);
  const dueCompletionNum = toNumberSafe(dueCompletion);

  const step1Valid = Boolean(name && address && propertyUnderAppraisal && stateCode && county);
  const step2Valid = Boolean(parcel);
  const step3Valid =
    Boolean(parcel && fee && !Number.isNaN(feeNum) && feeNum > 0) &&
    !Number.isNaN(dueSigningNum) &&
    !Number.isNaN(dueCompletionNum) &&
    dueSigningNum >= 0 &&
    dueCompletionNum >= 0 &&
    dueSigningNum + dueCompletionNum === 100;

  const step4Valid = Boolean(customerEmail && generatedPdfPath);

  const canGoNext =
    (step === 1 && step1Valid) ||
    (step === 2 && step2Valid) ||
    (step === 3 && step3Valid) ||
    (step === 4 && step4Valid);

  // GENERATE REPORT
  const handleSubmit = async e => {
    e.preventDefault();
    setEmailStatus('');
    setStatus('info', '');

    if (!step1Valid || !step2Valid) {
      setStatus('error', 'Complete steps 1 and 2 before generating the letter.');
      return;
    }

    if (!step3Valid) {
      setStatus(
        'error',
        'Check Step 3: Fee must be a positive number and Signing + Completion must equal 100%.'
      );
      return;
    }

    // Cancel previous generate request
    if (generateAbortRef.current) generateAbortRef.current.abort();
    const controller = new AbortController();
    generateAbortRef.current = controller;

    setLoading(true);
    setStatus('info', 'Generating PDF…');

    try {
      const res = await api.postJson(
        '/generate_report',
        {
          name,
          address,
          property_under_appraisal: propertyUnderAppraisal,
          parcel_id: parcel,
          fee,
          due_signing: dueSigning,
          due_completion: dueCompletion,
          report_date: reportDate,
        },
        { signal: controller.signal, timeoutMs: 120000 }
      );

      // Expect PDF blob
      const blob = await res.blob();

      // Pull filename if provided
      const disposition = res.headers.get('Content-Disposition') || '';
      let fileName = 'Engagement_Letter.pdf';
      const match = disposition.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) fileName = match[1];

      setGeneratedPdfPath(fileName);

      // Safe download: revoke object URL after click
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      setStatus('success', 'Engagement letter generated and downloaded.');
      // Optional: advance automatically to step 4
      setStep(4);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setStatus('error', err?.message || 'Error generating report.');
    } finally {
      setLoading(false);
    }
  };

  // SEND EMAIL
  const handleSendEmail = async () => {
    setStatus('info', '');
    if (!customerEmail) {
      setEmailStatus('');
      setStatus('error', 'Enter customer email.');
      return;
    }
    if (!generatedPdfPath) {
      setEmailStatus('');
      setStatus('error', 'Generate the engagement letter first.');
      return;
    }

    setSendingEmail(true);
    setEmailStatus('Sending…');

    try {
      await api.postJson('/send_email', {
        pdf_path: generatedPdfPath,
        customer_email: customerEmail,
        client_name: name,
        address,
      });

      setEmailStatus('Email sent successfully ✔');
      setStatus('success', 'Email sent.');
    } catch (err) {
      setEmailStatus('Failed to send email ❌');
      setStatus('error', err?.message || 'Failed to send email.');
    } finally {
      setSendingEmail(false);
    }
  };

  const stepTitleMap = {
    1: 'Client & Property Information',
    2: 'Parcel Information',
    3: 'Agreement Details',
    4: 'Send Agreement',
  };

  const progressPercent = (step / 4) * 100;

  // LOGIN PAGE (UNCHANGED visually)
  if (!auth) {
    return (
      <div
        className="relative w-full h-screen bg-cover bg-center flex flex-col justify-between"
        style={{ backgroundImage: "url('/thg_mosaic.jpg')" }}
      >
        {showLogin && <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>}

        <div className="relative z-10 flex flex-col items-center mt-14">
          <img src="/thg_logo.png" className="w-[320px]" alt="logo" />

          <div className="mt-4 text-[#d1b156] text-lg tracking-[0.35em] font-light text-center">
            REAL ESTATE • TRUST • EXCELLENCE • PROFESSIONALISM
          </div>

          <button
            onClick={() => setShowLogin(true)}
            className="mt-8 px-6 py-2 border border-[#d1b156] text-[#d1b156] bg-black/60 rounded-lg"
          >
            LOGIN
          </button>
        </div>

        {showLogin && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="bg-black/85 border border-yellow-600 rounded-xl p-6 w-full max-w-md">
              <div className="flex flex-col items-center mb-5">
                <img src="/thg_logo.png" className="w-[120px] opacity-90" alt="small-logo" />
                <h2 className="text-[#d1b156] text-xl mt-2">THG Internal Access</h2>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <Input label="Username" value={loginUser} setter={setLoginUser} />
                <Input label="Password" type="password" value={loginPass} setter={setLoginPass} />

                {loginError && <div className="text-red-400 text-sm">{loginError}</div>}

                <button className="w-full mt-2 py-2 bg-[#d1b156] text-black rounded-lg">
                  Login
                </button>

                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  className="w-full mt-2 text-gray-300 underline text-xs"
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}

        <div className="relative z-10 flex justify-center mb-6 text-gray-400 text-xs">
          © {new Date().getFullYear()} The Hammonds Group
        </div>
      </div>
    );
  }

  // MAIN TOOL WIZARD UI
  return (
    <div
      className="min-h-screen bg-cover bg-center relative"
      style={{ backgroundImage: "url('/thg_mosaic.jpg')" }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md"></div>

      <div className="relative z-10 max-w-[1100px] mx-auto pt-6 px-4 pb-10">
        {/* HEADER */}
        <div className="flex justify-between text-yellow-300 text-sm mb-4">
          <div>Logged in as: {currentUser}</div>
          <button
            onClick={() => {
              // abort inflight requests on logout
              fetchParcelAbortRef.current?.abort?.();
              generateAbortRef.current?.abort?.();

              setAuth(false);
              setToken('');
              setCurrentUser('');
              setStep(1);
              setStatus('info', '');
              setEmailStatus('');
              setGeneratedPdfPath('');
            }}
            className="px-4 py-1 border border-[#d1b156] rounded-md"
          >
            LOGOUT
          </button>
        </div>

        {/* STATUS BANNER */}
        <div className="mb-4">
          <InlineStatus type={globalStatus.type} message={globalStatus.message} />
        </div>

        {/* PROGRESS BAR P4 */}
        <div className="backdrop-blur-md bg-black/40 border border-yellow-500/40 rounded-2xl px-6 py-4 mb-6 shadow-xl">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs text-gray-300">
              Step <span className="font-semibold text-yellow-300">{step}</span> of{' '}
              <span className="font-semibold text-yellow-300">4</span>
            </div>
            <div className="text-xs text-yellow-300 font-semibold">{stepTitleMap[step]}</div>
          </div>

          <div className="w-full h-2 bg-neutral-700 rounded-full overflow-hidden">
            <div
              className="h-2 bg-yellow-400 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* WIZARD CONTENT */}
        <div className="backdrop-blur-sm bg-black/40 border border-yellow-500/30 rounded-2xl p-8 shadow-xl">
          {step === 1 && (
            <Step1ClientProperty
              name={name}
              setName={setName}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              address={address}
              setAddress={setAddress}
              stateCode={stateCode}
              setStateCode={setStateCode}
              county={county}
              setCounty={setCounty}
              propertyUnderAppraisal={propertyUnderAppraisal}
              setPropertyUnderAppraisal={setPropertyUnderAppraisal}
            />
          )}

          {step === 2 && (
            <Step2Parcel
              parcel={parcel}
              setParcel={setParcel}
              handleFetchParcel={handleFetchParcel}
              fetchingParcel={fetchingParcel}
            />
          )}

          {step === 3 && (
            <Step3Agreement
              fee={fee}
              setFee={setFee}
              dueSigning={dueSigning}
              setDueSigning={v => setDueSigning(clampPercentString(v))}
              dueCompletion={dueCompletion}
              setDueCompletion={v => setDueCompletion(clampPercentString(v))}
              reportDate={reportDate}
              setReportDate={setReportDate}
              loading={loading}
              handleSubmit={handleSubmit}
              validationHint={
                Number.isNaN(dueSigningNum) || Number.isNaN(dueCompletionNum)
                  ? 'Enter numeric percentages.'
                  : dueSigningNum + dueCompletionNum !== 100
                  ? 'Signing + Completion must equal 100%.'
                  : ''
              }
            />
          )}

          {step === 4 && (
            <Step4Email
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              sendingEmail={sendingEmail}
              handleSendEmail={handleSendEmail}
              emailStatus={emailStatus}
              canSend={Boolean(customerEmail && generatedPdfPath)}
              generatedPdfPath={generatedPdfPath}
            />
          )}

          {/* NAVIGATION BUTTONS */}
          <div className="flex justify-between mt-8 pt-6 border-t border-yellow-500/20">
            {/* BACK BUTTON — Secondary */}
            <button
              type="button"
              onClick={() => setStep(s => Math.max(1, s - 1))}
              disabled={step === 1 || loading || fetchingParcel || sendingEmail}
              className={`px-5 py-2 text-xs rounded-md border ${
                step === 1 || loading || fetchingParcel || sendingEmail
                  ? 'border-gray-600 text-gray-600 cursor-not-allowed'
                  : 'border-yellow-500 text-yellow-300 hover:bg-black/40'
              }`}
            >
              ← Back
            </button>

            {/* NEXT BUTTON — Primary (now gated by validation) */}
            <button
              type="button"
              onClick={() => setStep(s => Math.min(4, s + 1))}
              disabled={step === 4 || loading || fetchingParcel || sendingEmail || !canGoNext}
              className={`px-6 py-2 text-xs rounded-md ${
                step === 4 || loading || fetchingParcel || sendingEmail || !canGoNext
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-yellow-500 text-black hover:bg-yellow-400'
              }`}
              title={!canGoNext ? 'Complete required fields in this step to continue.' : ''}
            >
              {step === 4 ? 'Done' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- STEP COMPONENTS ---------------- */

function Step1ClientProperty({
  name,
  setName,
  customerEmail,
  setCustomerEmail,
  address,
  setAddress,
  stateCode,
  setStateCode,
  county,
  setCounty,
  propertyUnderAppraisal,
  setPropertyUnderAppraisal,
}) {
  return (
    <div className="space-y-8">
      <h2 className="text-lg text-yellow-300 font-semibold">
        Step 1 — Client & Property Information
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input label="Client Name" value={name} setter={setName} required />
        <Input
          label="Customer Email"
          value={customerEmail}
          setter={setCustomerEmail}
          type="email"
        />
        <Input label="Property Address" value={address} setter={setAddress} required />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* STATE */}
        <div>
          <label className="text-yellow-300 text-sm">State</label>
          <select
            className="mt-1 p-2 rounded-md bg-black/40 text-white border border-gray-400 w-full"
            value={stateCode}
            onChange={e => setStateCode(e.target.value)}
          >
            {STATE_OPTIONS.map(s => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* COUNTY */}
        <div>
          <label className="text-yellow-300 text-sm">County</label>
          <select
            className="mt-1 p-2 rounded-md bg-black/40 text-white border border-gray-400 w-full"
            value={county}
            onChange={e => setCounty(e.target.value)}
          >
            {(COUNTY_OPTIONS[stateCode] || []).map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Property Under Appraisal"
          value={propertyUnderAppraisal}
          setter={setPropertyUnderAppraisal}
          required
        />
      </div>
    </div>
  );
}

function Step2Parcel({ parcel, setParcel, handleFetchParcel, fetchingParcel }) {
  return (
    <div className="space-y-8">
      <h2 className="text-lg text-yellow-300 font-semibold">Step 2 — Parcel Information</h2>

      <div>
        <label className="text-yellow-300 text-sm">Parcel ID</label>
        <div className="flex gap-3">
          <input
            className="mt-1 p-2 rounded-md bg-black/40 text-white border border-gray-400 w-full"
            value={parcel}
            onChange={e => setParcel(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={handleFetchParcel}
            disabled={fetchingParcel}
            className={`px-4 py-2 rounded-md ${
              fetchingParcel
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-yellow-500 text-black hover:bg-yellow-400'
            }`}
          >
            {fetchingParcel ? 'Fetching…' : 'Fetch'}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-2">
          Auto-fetches from CRS. Manually enter if needed.
        </p>
      </div>
    </div>
  );
}

function Step3Agreement({
  fee,
  setFee,
  dueSigning,
  setDueSigning,
  dueCompletion,
  setDueCompletion,
  reportDate,
  setReportDate,
  loading,
  handleSubmit,
  validationHint,
}) {
  return (
    <div className="space-y-8">
      <h2 className="text-lg text-yellow-300 font-semibold">Step 3 — Agreement Details</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input label="Fee ($)" value={fee} setter={setFee} required />
          <Input label="Due at Signing (%)" value={dueSigning} setter={setDueSigning} />
          <Input label="Due at Completion (%)" value={dueCompletion} setter={setDueCompletion} />
        </div>

        {validationHint && <InlineStatus type="error" message={validationHint} />}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input label="Report Date" type="date" value={reportDate} setter={setReportDate} />
        </div>

        <button
          disabled={loading}
          className={`px-8 py-3 rounded-md ${
            loading
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
              : 'bg-yellow-500 text-black hover:bg-yellow-400'
          }`}
        >
          {loading ? 'Generating...' : 'Generate Engagement Letter'}
        </button>
      </form>
    </div>
  );
}

function Step4Email({
  customerEmail,
  setCustomerEmail,
  sendingEmail,
  handleSendEmail,
  emailStatus,
  canSend,
  generatedPdfPath,
}) {
  return (
    <div className="space-y-8">
      <h2 className="text-lg text-yellow-300 font-semibold">Step 4 — Send Agreement</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
        <Input
          label="Customer Email"
          value={customerEmail}
          setter={setCustomerEmail}
          type="email"
        />

        <button
          className={`px-6 py-3 rounded-md ${
            sendingEmail || !canSend
              ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
              : 'bg-yellow-500 text-black hover:bg-yellow-400'
          }`}
          disabled={sendingEmail || !canSend}
          onClick={handleSendEmail}
          type="button"
          title={!generatedPdfPath ? 'Generate the engagement letter first.' : ''}
        >
          {sendingEmail ? 'Sending…' : 'Send Email'}
        </button>

        <div className="text-yellow-300 text-sm">
          {emailStatus && (
            <div className="p-2 bg-black/40 border border-yellow-600 rounded-md">{emailStatus}</div>
          )}
        </div>
      </div>

      {!generatedPdfPath && (
        <div className="text-xs text-gray-400">
          Note: generate the engagement letter in Step 3 before sending.
        </div>
      )}
    </div>
  );
}

/* GENERIC INPUT FIELD COMPONENT */
function Input({ label, value, setter, type = 'text', required = false }) {
  return (
    <div>
      <label className="text-yellow-300 text-sm">{label}</label>
      <input
        className="mt-1 p-2 rounded-md bg-black/40 text-white border border-gray-400 w-full"
        type={type}
        required={required}
        value={value}
        onChange={e => setter(e.target.value)}
      />
    </div>
  );
}

export default App;
