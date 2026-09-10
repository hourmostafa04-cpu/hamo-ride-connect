import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Offer, VoiceNote } from "./hamoula-data";
import { mockOffers, offerVoiceNotes } from "./hamoula-data";
import { defaultDestination, defaultPickup, roadDistanceKm, type LatLng } from "./hamoula-geo";
import { counterOfferPrice } from "./hamoula-pricing";
import { supabase } from "@/integrations/supabase/client";
import {
  clearDraft,
  fetchBoard,
  fetchDraft,
  isRealBid,
  isRealLoad,
  removeBid,
  saveBid,
  saveBidStatus,
  saveDraft,
  saveLoad,
  saveLoadStatus,
} from "./hamoula-sync";
import { fetchAccount, migrateLocalAccounts, saveAccount } from "./hamoula-accounts";
import { notifyEvent } from "./push-client";


export type RoleId = "shipper" | "driver";

export type Profile = {
  id: string;
  name: string;
  role: RoleId;
  roleLabel: string;
  company: string;
  phone: string;
  rating: number;
  initials: string;
};

export const profiles: Profile[] = [
  {
    id: "p-shipper",
    name: "سعيد المرابط",
    role: "shipper",
    roleLabel: "صاحب بضاعة",
    company: "شركة الأطلس للتجارة",
    phone: "0661 22 44 88",
    rating: 4.8,
    initials: "س م",
  },
  {
    id: "p-driver",
    name: "يوسف العلمي",
    role: "driver",
    roleLabel: "صاحب شاحنة",
    company: "شاحنة متوسطة · 12345 - أ - 20",
    phone: "0670 11 33 55",
    rating: 4.9,
    initials: "ي ع",
  },
];

export type TripStatus =
  | "draft"
  | "searching"
  | "matched"
  | "enroute"
  | "loaded"
  | "delivered"
  | "cancelled";

export type TripRequest = {
  pickup: string;
  destination: string;
  /** Free-text cargo description written (or dictated) by the shipper. */
  cargo: string;
  pickupPoint: LatLng;
  destinationPoint: LatLng;
  truck: string;
  /** Selected capacity chip label, e.g. "3.5 طن". */
  capacity?: string;
  price: number;
  status: TripStatus;
  acceptedOffer: Offer | null;
  voiceNote: VoiceNote | null;
  updatedAt: number;
  /** Id of the published request this trip belongs to (null while a draft). */
  loadId?: string | null;
};

/** A cargo request published by a shipper — visible in the driver feed. */
export type Load = {
  id: string;
  shipper: string;
  /** Contact number of the shipper (call / WhatsApp from the driver dashboard). */
  shipperPhone?: string | undefined;
  pickup: string;
  destination: string;
  cargo: string;
  pickupPoint: LatLng;
  destinationPoint: LatLng;
  truck: string;
  capacity?: string | undefined;
  price: number;
  voiceNote: VoiceNote | null;
  createdAt: number;
  status: "open" | "assigned";
  /** Lifecycle of the transport itself, persisted in the shared backend. */
  tripStatus?: TripStatus;
  acceptedOffer?: Offer | null;
};

/** A driver answer to a load: either the suggested price or a counter-offer. */
export type Bid = {
  id: string;
  loadId: string;
  driverId: string;
  driver: string;
  driverPhone?: string | undefined;
  truck: string;
  plate: string;
  rating: number;
  trips: number;
  price: number;
  etaMin: number;
  kind: "accepted-price" | "counter";
  voiceNote: VoiceNote | null;
  shipperReply: VoiceNote | null;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
};


const defaultRequest: TripRequest = {
  pickup: "",
  destination: "",
  cargo: "",
  pickupPoint: defaultPickup,
  destinationPoint: defaultDestination,
  // No default truck: the shipper must choose one of the 8 vehicle cards.
  truck: "",
  capacity: "",
  price: 0,
  status: "draft",
  acceptedOffer: null,
  voiceNote: null,
  updatedAt: 0,
};

export function bidToOffer(b: Bid): Offer {
  return {
    id: b.id,
    driver: b.driver,
    truck: b.truck,
    rating: b.rating,
    trips: b.trips,
    price: b.price,
    eta: `${b.etaMin} دقيقة`,
    plate: b.plate,
  };
}

type Board = { loads: Load[]; bids: Bid[]; request: TripRequest };

/** Prototype account: phone is the credential, email is optional. */
export type Account = {
  name: string;
  phone: string;
  email?: string;
  role: RoleId;
  /** Driver only: capacity in tons, e.g. "3.5". */
  truckTons?: string;
  /** Driver only: vehicle kind label. */
  truckType?: string;
  /** Driver only: licence plate number. */
  truckPlate?: string;
  /** Driver only: availability (متوفر / غير متوفر). */
  available?: boolean;
};

/** Digits-only key used to look an account up by phone. */
export function phoneKey(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("00212")) return `0${d.slice(5)}`;
  if (d.startsWith("212")) return `0${d.slice(3)}`;
  return d;
}

type Ctx = {
  profile: Profile;
  switchProfile: (id: string) => void;
  account: Account | null;
  /** حالة جلسة Auth الحقيقية (ماشي الحساب المحفوظ محلياً). */
  sessionState: SessionState;
  /** True only when a valid Supabase session backs the account. */
  authed: boolean;
  /** True once localStorage has been read on the client. */
  ready: boolean;
  signIn: (account: Account) => void;
  signOut: () => void;
  /** Look an existing account up by phone number in the shared database. */
  findAccount: (phone: string) => Promise<Account | null>;
  /** Edit the signed-in account (name, role, truck…). */
  updateAccount: (patch: Partial<Account>) => void;

  request: TripRequest;
  updateRequest: (patch: Partial<TripRequest>) => void;
  resetRequest: () => void;
  /** When true the active trip advances on its own (demo live feed). */
  tripLive: boolean;
  setTripLive: (v: boolean) => void;
  loads: Load[];
  bids: Bid[];
  activeLoad: Load | null;
  publishLoad: (patch: Partial<TripRequest>) => Promise<Load>;
  addBid: (input: {
    loadId: string;
    price: number;
    kind: Bid["kind"];
    voiceNote?: VoiceNote | null;
  }) => Bid;
  acceptBid: (bidId: string) => Bid | null;
  declineBid: (bidId: string) => void;
  /** Driver pulls back a pending bid. */
  withdrawBid: (bidId: string) => void;
  /** Driver edits the price of a pending bid (counter-offer from history). */
  updateBidPrice: (bidId: string, price: number) => void;
  replyToBid: (bidId: string, note: VoiceNote) => void;
  myBidFor: (loadId: string) => Bid | null;
  /** Requests published by the signed-in shipper ("طلباتي"), newest first. */
  myLoads: Load[];
  /** Transports the signed-in driver won ("رحلاتي"), newest first. */
  myTrips: Load[];
  /** Offers sent by the signed-in driver ("عروضي"). */
  myBids: Bid[];
  /** Cancel a request (ملغى) — it stays in the history. */
  cancelRequest: (loadId?: string) => void;
  /** Unfinished request restored from the backend, if any. */
  pendingDraft: Partial<TripRequest> | null;
  /** Keep the unfinished request (متابعة الطلب غير المكتمل). */
  resumeDraft: () => Partial<TripRequest> | null;
  /** Throw the unfinished request away. */
  discardDraft: () => void;
  /** Live driver GPS position (null until granted). */
  myLocation: LatLng | null;
  geoStatus: GeoStatus;
  requestLocation: () => void;
  /** Pull the latest loads and bids from the shared backend. */
  refreshBoard: () => Promise<void>;
  /** True while the board (loads + bids) is being fetched. */
  boardLoading: boolean;
  /** Human message when the last board fetch failed (null when fine). */
  boardError: string | null;

};

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unsupported";

/** حالة جلسة Auth: كنفرقو بين انقطاع الشبكة وبين جلسة ملغاة فعلياً. */
export type SessionState = "checking" | "authenticated" | "offline" | "signed-out";

/** خطأ شبكة (fetch failed / offline) ماشي خطأ صلاحية توكن. */
function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const msg = (e as { message?: string } | null)?.message?.toLowerCase() ?? "";
  const name = (e as { name?: string } | null)?.name ?? "";
  return (
    name === "AuthRetryableFetchError" ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed") ||
    msg.includes("timeout")
  );
}

const HamoulaContext = createContext<Ctx | null>(null);

const STORAGE_KEY = "hamoula-profile";
const BOARD_KEY = "hamoula-board";
const ACCOUNT_KEY = "hamoula-account";
const ACCOUNTS_KEY = "hamoula-accounts";
const ACCOUNTS_MIGRATED_KEY = "hamoula-accounts-migrated";
/** كيتحط غير منين المستخدم يضغط «خروج من الحساب» — باش نفرقو على انقطاع الشبكة. */
const SIGNED_OUT_KEY = "hamoula-signed-out";


const GEO_KEY = "hamoula-location";

const shipperName = profiles[0]!.name;

/** Ordered live-trip progression used by the global trip engine. */
export const tripFlow: Partial<Record<TripStatus, TripStatus>> = {
  matched: "enroute",
  enroute: "loaded",
  loaded: "delivered",
};

export const tripOrder: TripStatus[] = ["matched", "enroute", "loaded", "delivered"];

export function HamoulaProvider({ children }: { children: ReactNode }) {
  const [profileId, setProfileId] = useState(profiles[0]!.id);
  const [board, setBoard] = useState<Board>({ loads: [], bids: [], request: defaultRequest });
  const [account, setAccount] = useState<Account | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>("checking");
  const [ready, setReady] = useState(false);
  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const watchId = useRef<number | null>(null);
  const hydrated = useRef(false);
  const boardRef = useRef(board);
  boardRef.current = board;
  /** True while a publish is in flight — blocks the draft autosave race. */
  const publishingRef = useRef(false);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus((s) => (s === "granted" ? s : "locating"));
    const onOk = (pos: GeolocationPosition) => {
      const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setMyLocation(p);
      setGeoStatus("granted");
      localStorage.setItem(GEO_KEY, JSON.stringify(p));
    };
    const onErr = () => setGeoStatus("denied");
    navigator.geolocation.getCurrentPosition(onOk, onErr, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
    if (watchId.current === null) {
      watchId.current = navigator.geolocation.watchPosition(onOk, onErr, {
        enableHighAccuracy: true,
        maximumAge: 15000,
      });
    }
  }, []);

  useEffect(
    () => () => {
      if (watchId.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    },
    [],
  );

  // The signed-in account's stored role is authoritative: never infer it from the
  // current screen or from a locally switched demo profile.
  const baseProfile = account
    ? (profiles.find((p) => p.role === account.role) ?? profiles[0]!)
    : (profiles.find((p) => p.id === profileId) ?? profiles[0]!);
  const profile: Profile = useMemo(
    () =>
      account
        ? {
            ...baseProfile,
            name: account.name,
            phone: account.phone,
            initials: account.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join(" "),
          }
        : baseProfile,
    [account, baseProfile],
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && profiles.some((p) => p.id === saved)) setProfileId(saved);
    const raw = localStorage.getItem(BOARD_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Board;
        // Demo/mock loads are disabled: only real database rows are shown.
        setBoard({ ...parsed, loads: parsed.loads.filter((l) => isRealLoad(l.id)) });
      } catch {
        /* ignore corrupt board; DB sync will fill real loads */
      }
    }
    const rawGeo = localStorage.getItem(GEO_KEY);
    if (rawGeo) {
      try {
        setMyLocation(JSON.parse(rawGeo) as LatLng);
      } catch {
        /* ignore corrupt location */
      }
    }

    const rawAccount = localStorage.getItem(ACCOUNT_KEY);
    if (rawAccount) {
      try {
        const local = JSON.parse(rawAccount) as Account;
        setAccount(local);
        // The shared database is authoritative for name/role/truck details.
        void fetchAccount(local.phone).then((remote) => {
          if (remote) {
            setAccount(remote);
            localStorage.setItem(ACCOUNT_KEY, JSON.stringify(remote));
          } else {
            void saveAccount(local);
          }
        });
      } catch {
        /* ignore corrupt account */
      }
    }

    // One-time lift of device-only accounts into the shared database.
    if (!localStorage.getItem(ACCOUNTS_MIGRATED_KEY)) {
      try {
        const all = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Account[];
        if (all.length) void migrateLocalAccounts(all);
      } catch {
        /* ignore corrupt registry */
      }
      localStorage.setItem(ACCOUNTS_MIGRATED_KEY, "1");
    }
    hydrated.current = true;
    setReady(true);

    // استرجاع الجلسة: كنعتمدو على Supabase (refresh token) ماشي على الحساب المحلي.
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (session) {
          // كنتأكدو أن التوكن مازال صالح عند الخادم (كيتجدد أوتوماتيكياً).
          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (userErr) {
            if (isNetworkError(userErr)) {
              setSessionState("offline");
              return;
            }
            // جلسة ملغاة فعلياً.
            await supabase.auth.signOut();
            setSessionState("signed-out");
            setAccount(null);
            localStorage.removeItem(ACCOUNT_KEY);
            return;
          }
          const sessionPhone = userData.user?.phone;
          setSessionState("authenticated");
          if (sessionPhone) {
            const remote = await fetchAccount(sessionPhone);
            if (remote) {
              setAccount(remote);
              localStorage.setItem(ACCOUNT_KEY, JSON.stringify(remote));
            }
          }
          return;
        }
        // ما كايناش جلسة: إلا كانت الشبكة مقطوعة كنحتافظو بالحساب بلا اعتباره داخل.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setSessionState("offline");
          return;
        }
        setSessionState("signed-out");
        setAccount(null);
        localStorage.removeItem(ACCOUNT_KEY);
      } catch (e) {
        // فشل شبكي: ما كنمسحوش الحساب، ولكن ما كنعتبروهش تسجيل دخول صالح.
        if (isNetworkError(e)) setSessionState("offline");
        else setSessionState("signed-out");
      }
    })();

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        if (session) setSessionState("authenticated");
        return;
      }
      if (event !== "SIGNED_OUT") return;
      setSessionState("signed-out");
      setAccount(null);
      localStorage.removeItem(ACCOUNT_KEY);
    });



    // Keep the other role's tab in sync — same board, two users.
    const onStorage = (e: StorageEvent) => {
      if (e.key === BOARD_KEY && e.newValue) {
        try {
          setBoard(JSON.parse(e.newValue) as Board);
        } catch {
          /* ignore */
        }
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      authSub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem(BOARD_KEY, JSON.stringify(board));
  }, [board]);

  const switchProfile = useCallback((id: string) => {
    setProfileId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  /** Local "accounts database": every registered phone number on this device. */
  const saveToRegistry = useCallback((next: Account) => {
    let all: Account[] = [];
    try {
      all = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Account[];
    } catch {
      all = [];
    }
    const key = phoneKey(next.phone);
    const merged = [next, ...all.filter((a) => phoneKey(a.phone) !== key)];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(merged));
  }, []);

  /** Shared database lookup, with the on-device registry as offline fallback. */
  const findAccount = useCallback(async (phone: string): Promise<Account | null> => {
    const key = phoneKey(phone);
    if (!key) return null;
    const remote = await fetchAccount(key);
    if (remote) {
      saveToRegistry(remote);
      return remote;
    }
    if (typeof localStorage === "undefined") return null;
    try {
      const all = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as Account[];
      const local = all.find((a) => phoneKey(a.phone) === key) ?? null;
      // Heal the shared database with an account that only existed locally.
      if (local) void saveAccount(local);
      return local;
    } catch {
      return null;
    }
  }, [saveToRegistry]);

  const signIn = useCallback(
    (next: Account) => {
      setAccount(next);
      localStorage.removeItem(SIGNED_OUT_KEY);
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
      saveToRegistry(next);
      void saveAccount(next);
      const target = profiles.find((p) => p.role === next.role) ?? profiles[0]!;
      setProfileId(target.id);
      localStorage.setItem(STORAGE_KEY, target.id);
    },
    [saveToRegistry],
  );

  const updateAccount = useCallback(
    (patch: Partial<Account>) => {
      setAccount((cur) => {
        if (!cur) return cur;
        const next = { ...cur, ...patch };
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
        saveToRegistry(next);
        void saveAccount(next);
        return next;
      });
    },
    [saveToRegistry],
  );

  const signOut = useCallback(() => {
    setAccount(null);
    localStorage.setItem(SIGNED_OUT_KEY, "1");
    localStorage.removeItem(ACCOUNT_KEY);
    // End the verified phone session too — the account row stays in the database.
    void supabase.auth.signOut();

  }, []);


  const updateRequest = useCallback((patch: Partial<TripRequest>) => {
    setBoard((b) => ({ ...b, request: { ...b.request, ...patch, updatedAt: Date.now() } }));
  }, []);

  const resetRequest = useCallback(() => setBoard((b) => ({ ...b, request: defaultRequest })), []);

  // ---- Shared backend sync -------------------------------------------------
  const accountPhone = account ? phoneKey(account.phone) : "";
  const driverKey = account?.role === "driver" ? `d-${accountPhone}` : profiles[1]!.id;

  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  /** Pull requests + offers from the shared database (keeps demo/mock rows). */
  const refreshFromDb = useCallback(async () => {
    setBoardLoading(true);
    try {
      const remote = await fetchBoard();
      setBoard((b) => ({
        ...b,
        loads: remote.loads,
        bids: [...remote.bids, ...b.bids.filter((x) => !isRealBid(x.driverId))],
      }));
      setBoardError(null);
    } catch (err) {
      console.error("[hamoula] refreshBoard فشل", err);
      setBoardError("ما قدرناش نجيبو الطلبات. تحقق من الاتصال بالإنترنت وعاود المحاولة.");
      throw err;
    } finally {
      setBoardLoading(false);
    }
  }, []);

  useEffect(() => {
    // ما كنجلبوش الطلبات/العروض قبل ما تتأكد الجلسة — كانت كتعطي 401 عند أول دخول.
    if (!ready || sessionState !== "authenticated") return;
    void refreshFromDb().catch(() => {});
    const channel = supabase
      .channel("hamoula-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "loads" }, () => {
        void refreshFromDb();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bids" }, () => {
        void refreshFromDb();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, sessionState, refreshFromDb]);


  // ---- Unfinished request draft (survives closing the app) -----------------
  const [pendingDraft, setPendingDraft] = useState<Partial<TripRequest> | null>(null);
  const draftVersionRef = useRef(0);

  useEffect(() => {
    if (!ready || !accountPhone || account?.role !== "shipper") return;
    let stale = false;
    const version = draftVersionRef.current;
    void fetchDraft(accountPhone).then((d) => {
      if (stale || version !== draftVersionRef.current || !d) return;
      if (d.pickup || d.destination || d.cargo) setPendingDraft(d);
    });
    return () => {
      stale = true;
    };
  }, [ready, accountPhone, account?.role]);

  const currentRequest = board.request;
  useEffect(() => {
    if (!ready || !accountPhone || account?.role !== "shipper") return;
    if (currentRequest.status !== "draft") return;
    const hasContent = Boolean(
      currentRequest.pickup || currentRequest.destination || currentRequest.cargo,
    );
    const t = setTimeout(() => {
      // Never re-save a draft while/after a publish is being finalized.
      if (publishingRef.current) return;
      if (hasContent) void saveDraft(accountPhone, currentRequest);
      else void clearDraft(accountPhone);
    }, 700);
    return () => clearTimeout(t);
  }, [ready, accountPhone, account?.role, currentRequest]);

  const resumeDraft = useCallback(() => {
    const d = pendingDraft;
    if (d) updateRequest({ ...d, status: "draft" });
    setPendingDraft(null);
    return d;
  }, [pendingDraft, updateRequest]);

  const discardDraft = useCallback(() => {
    draftVersionRef.current += 1;
    setPendingDraft(null);
    if (accountPhone) void clearDraft(accountPhone);
  }, [accountPhone]);

  // ---- Global trip engine: the active trip advances wherever the user is ----
  const [tripLive, setTripLive] = useState(true);
  const tripStatus = board.request.status;
  const currentLoadId = board.request.loadId ?? null;

  useEffect(() => {
    if (!ready || !tripLive) return;
    const next = tripFlow[tripStatus as keyof typeof tripFlow];
    if (!next) return;
    const t = setTimeout(() => updateRequest({ status: next }), 9000);
    return () => clearTimeout(t);
  }, [ready, tripLive, tripStatus, updateRequest]);

  // Persist every lifecycle change of the active trip.
  useEffect(() => {
    if (!ready || !currentLoadId || tripStatus === "draft") return;
    void saveLoadStatus(currentLoadId, { tripStatus });
    setBoard((b) => ({
      ...b,
      loads: b.loads.map((l) => (l.id === currentLoadId ? { ...l, tripStatus } : l)),
    }));
  }, [ready, currentLoadId, tripStatus]);

  const publishLoad = useCallback(
    async (patch: Partial<TripRequest>): Promise<Load> => {
      // عمليات محمية: خاص جلسة Auth صالحة (ماشي غير حساب محفوظ محلياً).
      if (sessionState !== "authenticated") {
        throw new Error("الجلسة غير متاحة حالياً. تحقق من الاتصال ثم أعد المحاولة.");
      }
      publishingRef.current = true;
      const id = `L-${Date.now()}`;
      // Build the new load explicitly, outside any React state update.
      const base = boardRef.current.request;
      const req: TripRequest = {
        ...base,
        ...patch,
        status: "searching",
        acceptedOffer: null,
        loadId: id,
        updatedAt: Date.now(),
      };
      const created: Load = {
        id,
        shipper: account?.role === "shipper" ? account.name : shipperName,
        shipperPhone: account?.role === "shipper" ? account.phone : undefined,
        pickup: req.pickup,
        destination: req.destination,
        cargo: req.cargo ?? "",
        pickupPoint: req.pickupPoint,
        destinationPoint: req.destinationPoint,
        truck: req.truck,
        capacity: req.capacity,
        price: req.price,
        voiceNote: req.voiceNote,
        createdAt: Date.now(),
        status: "open",
        tripStatus: "searching",
        acceptedOffer: null,
      };
      // Persist FIRST: the request is only "published" once the INSERT succeeds.
      try {
        await saveLoad(created);
      } catch (err) {
        console.error("[hamoula] publishLoad: حفظ الطلب فشل، ما غاديش يتنشر", err);
        publishingRef.current = false;
        throw err;
      }
      // The published request never lingers in the form state: start from a
      // brand-new empty request so reopening the page shows empty fields.
      setBoard((b) => ({
        request: { ...defaultRequest, updatedAt: Date.now() },
        loads: [created, ...b.loads],
        bids: b.bids,
      }));
      void notifyEvent("new-load");
      if (accountPhone) void clearDraft(accountPhone);
      setPendingDraft(null);
      publishingRef.current = false;
      return created;
    },
    [account, accountPhone, sessionState],
  );

  const addBid = useCallback<Ctx["addBid"]>(
    ({ loadId, price, kind, voiceNote = null }) => {
      const bid: Bid = {
        id: `B-${Date.now()}`,
        loadId,
        driverId: driverKey,
        driver: account?.role === "driver" ? account.name : profiles[1]!.name,
        driverPhone: account?.role === "driver" ? account.phone : undefined,
        truck:
          account?.role === "driver" && account.truckType ? account.truckType : "شاحنة متوسطة",
        plate: account?.truckPlate?.trim() || "12345 - أ - 20",
        rating: profiles[1]!.rating,
        trips: 214,
        price,
        etaMin: 20,
        kind,
        voiceNote,
        shipperReply: null,
        status: "pending",
        createdAt: Date.now(),
      };
      setBoard((b) => ({
        ...b,
        bids: [...b.bids.filter((x) => !(x.loadId === loadId && x.driverId === bid.driverId)), bid],
      }));
      void saveBid(bid).then(() => notifyEvent("new-bid", { loadId }));
      return bid;
    },
    [account, driverKey],
  );

  const acceptBid = useCallback((bidId: string) => {
    let accepted: Bid | null = null;
    setBoard((b) => {
      const bid = b.bids.find((x) => x.id === bidId);
      if (!bid) return b;
      accepted = { ...bid, status: "accepted" };
      const offer = bidToOffer(bid);
      // Persist: request becomes "تم قبول سائق", the winning offer is saved.
      void saveLoadStatus(bid.loadId, {
        tripStatus: "matched",
        status: "assigned",
        acceptedOffer: offer,
        price: bid.price,
      });
      void saveBidStatus(bidId, { status: "accepted" }).then(() =>
        notifyEvent("bid-answer", { bidId }),
      );
      b.bids
        .filter((x) => x.loadId === bid.loadId && x.id !== bidId)
        .forEach(
          (x) =>
            void saveBidStatus(x.id, { status: "declined" }).then(() =>
              notifyEvent("bid-answer", { bidId: x.id }),
            ),
        );
      return {
        loads: b.loads.map((l) =>
          l.id === bid.loadId
            ? { ...l, status: "assigned" as const, tripStatus: "matched" as const, acceptedOffer: offer }
            : l,
        ),
        bids: b.bids.map((x) =>
          x.id === bidId
            ? { ...x, status: "accepted" as const }
            : x.loadId === bid.loadId
              ? { ...x, status: "declined" as const }
              : x,
        ),
        request: {
          ...b.request,
          loadId: bid.loadId,
          status: "matched",
          price: bid.price,
          acceptedOffer: offer,
          updatedAt: Date.now(),
        },
      };
    });
    return accepted;
  }, []);

  const declineBid = useCallback((bidId: string) => {
    void saveBidStatus(bidId, { status: "declined" }).then(() =>
      notifyEvent("bid-answer", { bidId }),
    );
    setBoard((b) => ({
      ...b,
      bids: b.bids.map((x) => (x.id === bidId ? { ...x, status: "declined" as const } : x)),
    }));
  }, []);

  const withdrawBid = useCallback((bidId: string) => {
    void removeBid(bidId);
    setBoard((b) => ({ ...b, bids: b.bids.filter((x) => x.id !== bidId) }));
  }, []);

  /** Cancel a request without deleting it — it stays visible as "ملغى". */
  const cancelRequest = useCallback(
    (loadId?: string) => {
      const id = loadId ?? board.request.loadId ?? null;
      if (id) void saveLoadStatus(id, { tripStatus: "cancelled", status: "assigned" });
      setBoard((b) => ({
        ...b,
        loads: id
          ? b.loads.map((l) => (l.id === id ? { ...l, tripStatus: "cancelled" as const } : l))
          : b.loads,
        request:
          !loadId || loadId === b.request.loadId
            ? { ...b.request, status: "cancelled", updatedAt: Date.now() }
            : b.request,
      }));
    },
    [board.request.loadId],
  );


  const updateBidPrice = useCallback((bidId: string, price: number) => {
    void saveBidStatus(bidId, { price, status: "pending" });
    setBoard((b) => ({
      ...b,
      bids: b.bids.map((x) =>
        x.id === bidId
          ? { ...x, price, kind: "counter" as const, status: "pending" as const, createdAt: Date.now() }
          : x,
      ),
    }));
  }, []);


  const replyToBid = useCallback((bidId: string, note: VoiceNote) => {
    setBoard((b) => ({
      ...b,
      bids: b.bids.map((x) => (x.id === bidId ? { ...x, shipperReply: note } : x)),
    }));
  }, []);

  const activeLoad = board.loads.find((l) => l.status === "open") ?? board.loads[0] ?? null;

  // Simulated competing drivers bidding on the freshest open load.
  const activeLoadId = activeLoad?.id ?? null;
  const activeLoadStatus = activeLoad?.status ?? null;
  const activeLoadPrice = activeLoad?.price ?? 0;
  const activeLoadTruck = activeLoad?.truck;
  const routeKm = activeLoad
    ? roadDistanceKm(activeLoad.pickupPoint, activeLoad.destinationPoint)
    : 0;
  useEffect(() => {
    if (!activeLoadId || activeLoadStatus !== "open") return;
    const pool = mockOffers.filter((o) => o.driver !== profiles[1]!.name);
    let i = 0;
    const t = setInterval(() => {
      const next = pool[i];
      i += 1;
      if (!next) {
        clearInterval(t);
        return;
      }
      setBoard((b) => {
        if (b.bids.some((x) => x.loadId === activeLoadId && x.driverId === `mock-${next.id}`)) {
          return b;
        }
        // Deterministic per-driver spread so prices stay stable across renders.
        const variance = ((Number(next.id) * 37) % 100) / 100;
        const price = counterOfferPrice(routeKm, activeLoadTruck, activeLoadPrice, variance);
        const etaMin = Math.max(8, Math.round(10 + i * 8));
        const bid: Bid = {
          id: `B-${next.id}-${activeLoadId}`,
          loadId: activeLoadId,
          driverId: `mock-${next.id}`,
          driver: next.driver,
          truck: next.truck,
          plate: next.plate,
          rating: next.rating,
          trips: next.trips,
          price,
          etaMin,
          kind: price === activeLoadPrice ? "accepted-price" : "counter",
          voiceNote: offerVoiceNotes[next.id] ?? null,
          shipperReply: null,
          status: "pending",
          createdAt: Date.now(),
        };
        return { ...b, bids: [...b.bids, bid] };
      });
    }, 4000);
    return () => clearInterval(t);
  }, [activeLoadId, activeLoadStatus, activeLoadPrice, activeLoadTruck, routeKm]);


  const myBidFor = useCallback(
    (loadId: string) =>
      board.bids.find((x) => x.loadId === loadId && x.driverId === driverKey) ?? null,
    [board.bids, driverKey],
  );

  /** "طلباتي" — every request this shipper published, newest first. */
  const myLoads = useMemo(() => {
    if (account?.role !== "shipper") return [];
    const key = accountPhone;
    return board.loads
      .filter((l) => isRealLoad(l.id) && (!key || phoneKey(l.shipperPhone ?? "") === key))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [board.loads, account?.role, accountPhone]);

  /** "عروضي" — every offer this driver sent. */
  const myBids = useMemo(
    () => board.bids.filter((x) => x.driverId === driverKey).sort((a, b) => b.createdAt - a.createdAt),
    [board.bids, driverKey],
  );

  /** "رحلاتي" — transports won by this driver (active + history). */
  const myTrips = useMemo(() => {
    const wonLoadIds = new Set(
      board.bids.filter((x) => x.driverId === driverKey && x.status === "accepted").map((x) => x.loadId),
    );
    return board.loads.filter((l) => wonLoadIds.has(l.id)).sort((a, b) => b.createdAt - a.createdAt);
  }, [board.loads, board.bids, driverKey]);

  // Drivers get their position automatically once signed in.
  useEffect(() => {
    if (!ready || profile.role !== "driver") return;
    requestLocation();
  }, [ready, profile.role, requestLocation]);

  const value = useMemo(
    () => ({
      profile,
      switchProfile,
      account,
      sessionState,
      authed: sessionState === "authenticated",
      ready,
      signIn,
      signOut,
      findAccount,
      updateAccount,

      request: board.request,
      updateRequest,
      resetRequest,
      tripLive,
      setTripLive,
      loads: board.loads,
      bids: board.bids,
      activeLoad,
      publishLoad,
      addBid,
      acceptBid,
      declineBid,
      withdrawBid,
      updateBidPrice,
      replyToBid,
      myBidFor,
      myLoads,
      myTrips,
      myBids,
      cancelRequest,
      pendingDraft,
      resumeDraft,
      discardDraft,
      myLocation,
      geoStatus,
      requestLocation,
      refreshBoard: refreshFromDb,
      boardLoading,
      boardError,
    }),
    [
      profile,
      switchProfile,
      account,
      sessionState,
      ready,
      signIn,
      signOut,
      findAccount,
      updateAccount,

      board,
      activeLoad,
      updateRequest,
      resetRequest,
      tripLive,
      publishLoad,
      addBid,
      acceptBid,
      declineBid,
      withdrawBid,
      updateBidPrice,
      replyToBid,
      myBidFor,
      myLoads,
      myTrips,
      myBids,
      cancelRequest,
      pendingDraft,
      resumeDraft,
      discardDraft,
      myLocation,
      geoStatus,
      requestLocation,
      refreshFromDb,
      boardLoading,
      boardError,
    ],
  );


  return <HamoulaContext.Provider value={value}>{children}</HamoulaContext.Provider>;
}

export function useHamoula() {
  const ctx = useContext(HamoulaContext);
  if (!ctx) throw new Error("useHamoula must be used inside HamoulaProvider");
  return ctx;
}

export const statusLabels: Record<TripStatus, string> = {
  draft: "مسودة",
  searching: "منشور / كنقلبو على سائق",
  matched: "تم قبول سائق",
  enroute: "في الطريق",
  loaded: "تم تحميل البضاعة",
  delivered: "تم التسليم",
  cancelled: "ملغى",
};

