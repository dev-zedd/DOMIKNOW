# DOMIKNOW - MAINTENANCE & WORK ORDER MODULE
## Komprehensibong Dokumentasyon, Arkitektura, at Batayang Alituntunin (Reference Guide)

---

## 1. Pambungad at Pangkalahatang Pilosopiya

Ang **Maintenance & Work Order Module** ng DOMIKNOW ay dinisenyo upang maging patas, mabilis, at mapagkakatiwalaan para sa lahat ng partido sa isang paupahan. 

Upang maiwasan ang alitan, pang-aabuso, at maling paniningil, ang buong module ay nakasalig sa prinsipyo ng **"Clean Separation of Duties"** at **"Neutral Arbiter Principle"**:

1. **Walang Panghuhula sa Simula (No Speculative Root Cause):**
   * Kapag nag-file ang Tenant, **obserbasyon at sintomas lamang** ang inilalagay (hal. *"Tumutulo ang kisame kapag umuulan"*, *"Hindi umiikot ang bentilador ng aircon"*). 
   * **Bakit?** Kapag pinayagang maglagay agad ang Tenant o Landlord ng paratang o dahilan (hal. *"Sinira ng bata"* o *"Lumang tubo na may sira"*), nagkakaroon agad ng bias at alitan bago pa man masilip ng eksperto ang problema.
2. **Eksperto ang Nagsusuri (Ocular Inspection by Field Technicians):**
   * Ang accredited Maintenance Personnel ang pupunta sa unit upang magsagawa ng pormal na ocular inspection. Sila lamang ang mag-uulat ng tunay na sanhi ng sira, magkakalkula ng materyales at serbisyo, at kukuha ng litrato bago simulan ang gawa.
3. **Admin bilang Neutral Legal Arbiter (Civil Code Decision):**
   * Hindi maaaring si Landlord ang magdikta kung sino ang magbabayad. Ang **Admin** ang magpapataw ng opisyal na legal liability alinsunod sa batas ng Pilipinas bago aprubahan ang quote.
4. **Transparent Quotation at Multi-Party Sign-Off:**
   * Bago ang aktwal na repair, aprubado muna ang quote ng partido na mananagot. Pagkatapos ng repair, may two-way verification (Landlord verification at Tenant confirmation/rework request) bago tuluyang isara ang ticket.

---

## 2. Batayang Legal (Civil Code of the Philippines)

Ang pagpapasiya ng pananagutan (Liability Determination) ng Admin ay nakabatay sa mga sumusunod na probisyon ng **Civil Code of the Philippines**:

| Probisyon | May Pananagutan | Sitwasyon at Halimbawa |
| :--- | :--- | :--- |
| **Civil Code Art. 1654** | **Landlord (Lessor)** | **Obligasyon ng May-ari:**<br>1. Panatilihing maayos at ligtas tirhan ang unit (*habitability*).<br>2. Sagutin ang lahat ng kinakailangang pagkukumpuni dulot ng **natural wear-and-tear**, kalumaan ng materyales, structural leaks, pundasyon, main electrical lines, at sira bago pa man umupa ang tenant.<br>*Halimbawa:* Kinakalawang na main drainage pipe, bitak sa bubong dahil sa bagyo, sunog na main breaker panel dahil sa kalumaan. |
| **Civil Code Art. 1657** | **Tenant (Lessee)** | **Obligasyon ng Umuupa:**<br>1. Gamitin ang unit bilang isang maingat na ama ng tahanan (*diligent father of a family*).<br>2. Sagutin ang pinsalang dulot ng **kapabayaan (negligence)**, maling paggamit (*misuse*), kawalan ng pag-iingat, o sadyang pagkasira.<br>*Halimbawa:* Baradong inidoro dahil sa itinapong sanitary pads o wipes, nabasag na bintana dahil sa pagwawala, nasunog na outlet dahil sa pag-overload ng appliances. |
| **Civil Code 50/50 Equitable Split** | **Shared (50% Landlord / 50% Tenant)** | **Pinagsamang Sanhi (Mutual / Compounded Factors):**<br>Kapag may ambag ang parehong panig o hindi matukoy nang lubusan ang nag-iisang sanhi.<br>*Halimbawa:* Lumang gripo na may kalawang na, ngunit nabali nang bahagya dahil sa biglaang pagpiga ng tenant; o baradong lababo dulot ng lumang disenyo ng tubo na sinabayan ng grasa mula sa pagluluto. |

---

## 3. Mga Gampanin at Functions ng Bawat User

### A. TENANT (Umuupa)
Ang Tenant ang pangunahing nakakaranas ng mga isyu sa loob ng kanyang inuupahang unit.

* **Mga Kayang Gawin (Functions & Capabilities):**
  1. **Mag-submit ng Maintenance Request:**
     * Pumili ng kategorya (Plumbing, Electrical, Aircon/Appliance, Roofing, Carpentry, Lock/Security, Iba pa).
     * Pumili ng Urgency level (Low, Medium, High, Emergency).
     * Maglagay ng malinaw na **sintomas/obserbasyon** (hal. *"Mabagal bumaba ang tubig sa lababo"*).
     * Mag-attach ng picture ng nakikitang problema.
     * Magtakda ng nais na araw at oras ng pagbisita (*preferred access schedule*).
  2. **Subaybayan ang Real-Time Dispatch Status:**
     * Makita kung sino ang nakatalagang technician.
     * Makita ang field status: `Assigned` ➔ `Travelling` (papunta) ➔ `Arrived` (dumating) ➔ `Repairing` (ginagawa).
  3. **Tingnan ang Diagnostic Ocular Report at Admin Decision:**
     * Mabasa ang naging pagsusuri ng technician.
     * Makita kung sino ang itinalagang may sagot sa gastos (Landlord, Tenant, o Split) at ang legal notes ng Admin.
  4. **Aprubahan ang Quotation (Kung Tenant Liable o Split):**
     * Kung siya ang may sagot, may kapangyarihan siyang i-apruba ang cost bago magsimula ang magastos na pag-aayos.
  5. **Kumpirmahin ang Natapos na Trabaho o Humiling ng Rework:**
     * **Confirm Resolution:** Kapag maayos ang gawa, iki-click ang *"Confirm Completion"* upang maisara ang ticket.
     * **Request Rework:** Kung may tagas pa rin o hindi maayos ang repair, maaaring ibalik ang ticket sa technician kalakip ang paliwanag.
  6. **Magbayad sa System:**
     * Mag-settle ng kanyang bahagi sa repair cost gamit ang integrated payment form.

* **Mga HINDI Pwedeng Gawin (System Restrictions):**
  * HINDI maaaring mag-speculate o mag-akusa agad ng legal cause sa form.
  * HINDI maaaring magtalaga o mag-dispatch ng technician nang kusa.
  * HINDI maaaring baguhin ang presyo ng piyesa o labor ng technician.
  * HINDI maaaring magsara ng ticket nang hindi dumadaan sa completion report.

---

### B. LANDLORD (May-ari ng Paupahan)
Ang Landlord ang tagapangalaga ng ari-arian at may pananagutan sa pangunahing kaayusan nito.

* **Mga Kayang Gawin (Functions & Capabilities):**
  1. **Direktang Mag-issue ng Owner Work Order (Art. 1654):**
     * Para sa mga bakanteng kwarto (*vacant units*), paghahanda bago paupahan (*turnover cleaning*), o regular na maintenance ng gusali.
     * Ang ganitong request ay awtomatikong `approved` at diretso sa dispatch triage dahil ang may-ari mismo ang nag-utos at magbabayad.
  2. **I-monitor ang Lahat ng Requests sa kanyang mga Ari-arian:**
     * Naka-grupo ayon sa property at unit.
     * May search at status filtering (Pending, Assigned, In Progress, Completed, Closed).
  3. **Suriin ang Technician Diagnosis at Admin Decision:**
     * Makita ang litrato bago simulan ang gawa, listahan ng piyesa, at labor fee.
     * Mabasa ang pinal na pasya ng Admin kung bakit Landlord, Tenant, o Split ang pananagutan.
  4. **Aprubahan ang Quotation (Kung Landlord Liable o Split):**
     * Pag-apruba sa badyet ng materyales at serbisyo.
  5. **I-verify ang Natapos na Trabaho ng Technician:**
     * Pagsusuri sa "After" photos, resibo ng biniling piyesa, at technician sign-off notes.
  6. **Magbayad ng Repair Cost:**
     * Pagbabayad sa serbisyo ng technician para sa mga repair na pananagutan ng may-ari.
  7. **Tingnan ang Financial & Maintenance History:**
     * Kabuuang nagastos sa maintenance kada unit para sa tax at property accounting.

* **Mga HINDI Pwedeng Gawin (System Restrictions):**
  * HINDI maaaring piliting pagbayarin ang tenant nang sarili lamang (walang Admin arbiter ruling).
  * HINDI maaaring magbawas sa security deposit ng tenant nang walang validong maintenance report at liability decision.
  * HINDI maaaring i-reject ang mga lehitimong emergency repairs na lumalabag sa Civil Code Art. 1654 (habitability).

---

### C. MAINTENANCE PERSONNEL (Field Technician)
Ang Maintenance Personnel ang mga lisensyado o akreditadong tekniko (tubero, electrician, HVAC technician, karpintero).

* **Mga Kayang Gawin (Functions & Capabilities):**
  1. **Pamahalaan ang Task Queue:**
     * Tumanggap ng alerto sa bagong trabaho.
     * Tanggapin (`Accept`) o Tanggihan (`Decline`) ang job offer kalakip ang dahilan kung hindi available.
  2. **I-broadcast ang Field Progress sa Real-Time:**
     * I-click ang **"Start Travel"** (`travelling`) ➔ Maabisuhan ang Tenant at Landlord na papunta na ang technician.
     * I-click ang **"Mark Arrived"** (`arrived`) ➔ Patunay na nasa lokasyon na ang technician.
     * I-click ang **"Begin Work"** (`repairing`) ➔ Uumpisahan na ang pagsusuri o pag-aayos.
  3. **Magsagawa ng Ocular Inspection at Magsumite ng Quotation (`/inspection`):**
     * Ilagay ang natuklasang tunay na sira (*Problem Identified*).
     * Mag-upload ng "Before" photo ng nasirang bahagi.
     * Maglista ng kinakailangang materyales (Pangalan ng gamit, bilang, presyo kada piraso).
     * Maglagay ng tantsang bayad sa serbisyo (*Labor Cost*).
  4. **Magsumite ng Opisyal na Completion Report (`/worker-report`):**
     * Detalye ng mga ginawang aksyon at inayos.
     * Mag-upload ng "After" photo bilang patunay na gumagana na.
     * Panghuling resibo ng mga aktwal na nagastos sa materyales.
     * Safety at maintenance advice para maiwasan ang muling pagkasira.

* **Mga HINDI Pwedeng Gawin (System Restrictions):**
  * HINDI maaaring laktawan ang mga estado (hindi pwedeng mag-report ng complete nang hindi nag-a-arrived o repairing).
  * HINDI maaaring magpasya kung sino ang magbabayad sa pagitan ng Landlord at Tenant.
  * HINDI makikita ang mga kumpidensyal na dokumento ng lease agreement o pinansyal na tala ng tenant/landlord.

---

### D. ADMIN (Platform Arbiter & Dispatcher)
Ang Admin ang namamahala sa buong platform upang siguruhing patas ang operasyon at nasusunod ang batas.

* **Mga Kayang Gawin (Functions & Capabilities):**
  1. **Centralized Platform Triage:**
     * Makita ang lahat ng maintenance requests sa buong sistema.
     * I-filter ayon sa priority, kategorya, at lungsod/lokasyon.
  2. **Pamamahala ng Technician Personnel Pool:**
     * Mag-rehistro ng mga bagong accredited technicians (Plumber, Electrician, HVAC, Carpentry, atbp.).
     * Subaybayan ang active jobs at performance rating ng bawat technician.
  3. **Mag-Dispatch ng Technician:**
     * Piliin ang pinaka-angkop na technician mula sa roster base sa espesyalisasyon at lokasyon.
     * Magtakda ng target due date at initial dispatch notes.
  4. **Neutral Arbiter Liability Determination (`/set-liability`):**
     * Matapos isumite ng technician ang ocular findings at litrato, susuriin ito ni Admin.
     * Magpataw ng pormal na desisyon:
       * `landlord` (Civil Code Art. 1654: Natural wear & tear, structural defects)
       * `tenant` (Civil Code Art. 1657: Misuse, negligence, direct damage)
       * `split` (Equitable 50/50 sharing)
     * Magtala ng opisyal na legal justification na makikita sa audit log.
  5. **Emergency Intervention:**
     * May kapangyarihang mag-reassign ng technician kung hindi tumugon o nag-decline ang naunang worker.
     * Maaring i-override o magsagawa ng audit sa anumang kuwestiyonableng singil sa piyesa.

* **Mga HINDI Pwedeng Gawin (System Restrictions):**
  * HINDI maaaring magpataw ng liability nang walang teknikal na basehan mula sa ocular report ng technician.
  * HINDI maaaring baguhin ang kasaysayan ng audit trail o burahin ang mga litrato ng ebidensya.

---

## 4. Kumpletong Workflow at Proseso (End-to-End Lifecycle)

```
[ TENANT ]                     [ ADMIN ]                   [ TECHNICIAN ]               [ LANDLORD ]
   │                              │                              │                          │
   ├─ 1. Submit Request ─────────>│                              │                          │
   │  (Sintomas & Litrato)        │                              │                          │
   │                              ├─ 2. Triage & Dispatch ──────>│                          │
   │                              │     (Select Worker & Date)   │                          │
   │                              │                              ├─ 3. Accept Job           │
   │                              │                              │                          │
   │<─────────────────────────────┼──────────────────────────────┼─ 4. Real-time Status ───>│
   │                              │                              │    (Travel/Arrived)      │
   │                              │                              │                          │
   │                              │<─ 5. Ocular Quote Report ────┤                          │
   │                              │     (Diagnosis & Quote)      │                          │
   │                              │                              │                          │
   │                              ├─ 6. Neutral Arbitration      │                          │
   │                              │     (Art. 1654 vs Art. 1657) │                          │
   │                              │                              │                          │
   │<─────────────────────────────┴─ 7. Quote Notification ──────┼─────────────────────────>│
   │                              │                              │                          │
   ├─ 8. Approve Quote ──────────>│                              │                          │
   │  (Kung Tenant Liable)        │                              │                          ├─ Approve Quote (Landlord Liable)
   │                              │                              │<─────────────────────────┤
   │                              │                              │                          │
   │                              │                              ├─ 9. Execute Repairs      │
   │                              │                              │                          │
   │                              │<─ 10. Completion Report ─────┤                          │
   │                              │      (Labor/Parts/After Pic) │                          │
   │                              │                              │                          │
   │                              │                              │                          ├─ 11. Verify Work
   │                              │                              │                          │
   ├─ 12. Confirm Completion ────>│                              │                          │
   │      (O kaya Rework)         │                              │                          │
   │                              │                              │                          │
   ├─ 13. Settle Payment ────────>┼─────────────────────────────>│<─────────────────────────┼─ Settle Payment
   │                              │                              │                          │
   ▼                              ▼                              ▼                          ▼
                          [ TICKET CLOSED & ARCHIVED ]
```

### Mga Yugto ng Proseso (Detailed Step-by-Step):

1. **Yugto 1: Pag-uulat (Ingestion)**
   * **Tenant Flow:** May nasirang gripo. Pinasok ng Tenant ang details: Category: *Plumbing*, Urgency: *Medium*, Symptom: *"Tumutulo sa ilalim ng lababo kapag ginagamit"*. Status: `pending`.
   * **Landlord Direct Flow:** Nais magpapintura ng bakanteng Unit 202 bago magpapasok ng bagong umuupa. Nag-file ang may-ari ng work order sa ilalim ng Art. 1654. Agad itong nagiging `approved` at handa sa dispatch.

2. **Yugto 2: Triage at Dispatching ni Admin**
   * Tinitingnan ni Admin ang [admin/maintenance.html](file:///c:/DOMI%20ZED%20VERSION/DOMIKNOW/public/pages/admin/maintenance.html).
   * Pipiliin si *Juan dela Cruz (Accredited Plumber)* mula sa pool at maglalagay ng target deadline.
   * Status: Nagiging `assigned`.

3. **Yugto 3: Field Transit Tracking ng Technician**
   * Makikita ng Technician ang task sa kanyang mobile task list ([maintenance/tasks.html](file:///c:/DOMI%20ZED%20VERSION/DOMIKNOW/public/pages/maintenance/tasks.html)).
   * Iki-click ang **"Accept"** ➔ Status: `accepted`.
   * Pagsakay ng motor/sasakyan, iki-click ang **"Travelling"** ➔ Status: `travelling`.
   * Pagdating sa pinto ng unit, iki-click ang **"Arrived"** ➔ Status: `arrived`.
   * Pagsisimula ng inspeksyon, iki-click ang **"Start Work"** ➔ Status: `repairing`.

4. **Yugto 4: Ocular Inspection at Pagsumite ng Quotation**
   * Sinusuri ng tubero ang ilalim ng lababo: *"Pundido ang P-trap dahil sa kinain ng kalawang ang lumang thread."*
   * Kukuha ng litrato ng sirang P-trap.
   * Ilalagay sa inspection form:
     * Materyales: 1 pc PVC P-trap (₱250), 1 roll Teflon tape (₱40).
     * Labor fee: ₱450.
     * Kabuuan: ₱740.
   * I-submit ang ocular report (`/inspection`). Status: `inspection_submitted`.

5. **Yugto 5: Pormal na Hatol ng Admin (Liability Ruling)**
   * Binubuksan ni Admin ang ticket. Nabasa ang ulat ng tubero: *"Kinain ng kalawang ang lumang tubo (natural aging ng bakal)."*
   * Sinusuri ang batas: Pasok ito sa **Civil Code Art. 1654 (Landlord Duty to Repair Natural Wear & Tear)**.
   * Pipiliin ni Admin ang `landlord` bilang mananagot at maglalagay ng notes: *"Corrosion on 8-year-old original fitting. No evidence of impact or physical tampering by tenant."*
   * Status: Nagiging `quote_pending`.

6. **Yugto 6: Pag-apruba ng Quotation**
   * Makakatanggap ang Landlord ng abiso sa kanyang portal kasama ang buong quotation at Admin rationale.
   * Iki-click ng Landlord ang **"Approve Quotation"** ➔ Status: `quote_approved`.

7. **Yugto 7: Pagsasagawa ng Repair at Completion Report**
   * Bibilhin ng technician ang P-trap at ikakabit.
   * Kukuha ng litrato ng bagong kabit na walang tulo habang umaagos ang tubig.
   * I-submit ang **Completion Report** kalakip ang litrato at breakdown. Status: `completed`.

8. **Yugto 8: Two-Way Sign-off at Bayaran**
   * **Landlord Verification:** Iki-click ng Landlord ang **"Verify Work"** matapos suriin ang resibo at litrato.
   * **Tenant Confirmation:** Susubukan ng Tenant ang lababo. Kung maayos, iki-click ang **"Confirm Completion"** ➔ Status: `closed`.
   * Kung tumutulo pa rin, iki-click ng Tenant ang **"Request Rework"** kasama ang paliwanag. Babalik ang ticket sa `repairing`.
   * **Payment Settlement:** Magbabayad ang Landlord ng ₱740 sa technician sa pamamagitan ng platform billing (`/pay`).

---

## 5. Talaan ng mga Estado (Status Lifecycle State Machine)

| Estado (Status) | Kahulugan at Deskripsyon | Susunod na Posibleng Aksyon |
| :--- | :--- | :--- |
| `pending` | Bagong pasok na request mula sa tenant; naghihintay ng triage. | Admin Dispatch o Landlord Review |
| `approved` | Naaprubahan na ang request o diretso mula sa Landlord work order. | Pagtatalaga ng technician |
| `assigned` | May technician nang napili pero hindi pa tinatanggap ng technician. | Worker Accept o Decline |
| `accepted` | Tinanggap na ng technician ang trabaho. | Worker Start Travel |
| `travelling` | Papunta na ang technician sa lokasyon. | Worker Mark Arrived |
| `arrived` | Dumating na sa property ang technician. | Worker Begin Inspection/Work |
| `repairing` | Kasalukuyang ginagawa o iniinspeksyon ang unit. | Ocular Quote o Completion Report |
| `inspection_submitted` | Naisumite na ang ocular findings at presyo; naghihintay ng Admin liability ruling. | Admin Set Liability |
| `quote_pending` | May desisyon na sa pananagutan; naghihintay ng pagsang-ayon ng magbabayad. | Party Approve Quote |
| `quote_approved` | Aprubado na ang badyet; pwede nang bilhin ang gamit at ayusin. | Worker Final Repair |
| `completed` | Natapos na ang pagkukumpuni at may ulat na may bago/pagkatapos na litrato. | Landlord Verification |
| `verified` | Napatunayan na ng may-ari ang trabaho at naghihintay ng kumpirmasyon ng tenant. | Tenant Confirm o Rework |
| `closed` | Kumpirmado at tapos na ang ticket; bayad na o naitala sa ledger. | Archived Record |
| `rejected` | Hindi tinanggap ang request (may kalakip na opisyal na dahilan). | Closed / Archived |

---

## 6. Talaan ng mga Pages at REST API Endpoints

### Mga Pahina sa Frontend (UI Pages):

* **Tenant:**
  * `public/pages/tenant/maintenance.html` - Pag-file ng reklamo, listahan ng sariling tickets, inspection viewer, rework, at confirmation modal.
* **Landlord:**
  * `public/pages/landlord/maintenance.html` - Overview table, filtering ayon sa property, button para sa direct Art. 1654 work orders.
  * `public/pages/landlord/maintenance-details.html` - Detalyadong pagsusuri sa ticket, pagsusuri sa quote, verification ng ulat, at pagbabayad.
* **Maintenance Worker:**
  * `public/pages/maintenance/tasks.html` - Listahan ng assigned jobs at pending job offers.
  * `public/pages/maintenance/task-details.html` - Action buttons para sa travel states, ocular inspection & quote builder, at photo completion report.
* **Admin:**
  * `public/pages/admin/maintenance.html` - Centralized command hub, metrics strip, triage queue, dispatch modal, accredited worker pool manager, at neutral legal arbiter modal (`adminValidateLiability`).

### Mga Backend API Endpoints (`server/routes/maintenanceRoutes.js`):

| Method | Endpoint | Proteksyon (Role) | Deskripsyon |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/maintenance/requests` | Tenant | Pag-file ng bagong request gamit ang symptoms. |
| `GET` | `/api/maintenance/requests/tenant` | Tenant | Pagkuha sa listahan ng sariling requests. |
| `PUT` | `/api/maintenance/requests/:id/tenant-confirm` | Tenant | Pag-apruba sa closure o pag-request ng rework. |
| `GET` | `/api/maintenance/requests/landlord` | Landlord | Pagkuha sa lahat ng requests sa pag-aaring units. |
| `POST` | `/api/maintenance/landlord/requests` | Landlord | Pag-create ng direct Art. 1654 work order. |
| `PUT` | `/api/maintenance/requests/:id/landlord-verify` | Landlord | Pag-verify sa completion report ng technician. |
| `GET` | `/api/maintenance/requests/worker` | Maintenance | Pagkuha sa job task list ng technician. |
| `PUT` | `/api/maintenance/requests/:id/worker-respond` | Maintenance | Pagtanggap (`accepted`) o pagtanggi (`declined`) sa trabaho. |
| `PUT` | `/api/maintenance/requests/:id/worker-status` | Maintenance | Pag-update ng transit (`travelling`, `arrived`, `repairing`). |
| `POST` | `/api/maintenance/requests/:id/inspection` | Maintenance | Pagpasa ng ocular diagnosis, listahan ng piyesa, at quote. |
| `POST` | `/api/maintenance/requests/:id/worker-report` | Maintenance | Pagpasa ng final completion report at after photos. |
| `GET` | `/api/maintenance/requests/:id` | Lahat ng Roles | Pagkuha ng kumpletong detalye, timeline logs, at quote info. |
| `PUT` | `/api/maintenance/requests/:id/quote-decision` | Tenant, Landlord, Admin | Pag-apruba o pagtanggi sa diagnostic quotation. |
| `POST` | `/api/maintenance/requests/:id/pay` | Tenant, Landlord, Admin | Pagbayad sa repair cost ng mananagot na partido. |
| `GET` | `/api/maintenance/admin/overview` | Admin | Estadistika ng maintenance (pending, in progress, open costs). |
| `GET` | `/api/maintenance/admin/requests` | Admin | Lahat ng requests sa buong platform. |
| `GET` | `/api/maintenance/admin/workers` | Admin | Talaan ng lahat ng rehistradong technicians. |
| `POST` | `/api/maintenance/admin/workers` | Admin | Pag-rehistro ng bagong accredited technician. |
| `PUT` | `/api/maintenance/admin/requests/:id/dispatch` | Admin | Pormal na pag-dispatch ng technician sa isang ticket. |
| `PUT` | `/api/maintenance/admin/requests/:id/set-liability` | Admin | **Neutral Arbiter Ruling:** Pagtukoy kung Landlord (Art. 1654), Tenant (Art. 1657), o Split. |

---

## 7. Bakit Maiiwasan ang Pang-aabuso sa Sistemang Ito?

1. **Walang Unilateral Blame (Proteksyon sa Tenant):**
   * Hindi maaaring ibawas agad ng Landlord ang pampagawa sa deposit ng umuupa. Kailangan munang may litrato at ulat mula sa lisensyadong technician, at kumpirmasyon mula sa Admin arbiter alinsunod sa Art. 1654 / Art. 1657.
2. **Walang Frivolous o Fake Accusations (Proteksyon sa Landlord):**
   * Hindi maaaring magtago ang Tenant sa likod ng maling paratang dahil may ocular inspection. Kung mapatunayang kapabayaan (hal. banyagang bagay sa inidoro o sirang saksakan dahil sa sariling kagamitan), ang Tenant ang pananagutin ng Admin.
3. **Transparent Pricing (Proteksyon sa Lahat):**
   * Ang quotation ay itemized (nakalista ang bawat piyesa at labor). Walang hidden markups o overcharging.
4. **Permanent Audit Trail:**
   * Ang bawat pagpalit ng estado, pangalan ng nag-apruba, oras ng pagdating ng technician, at litrato ay permanenteng naka-record sa `maintenance_logs` at hindi mabubura.

---
*Ang dokumentong ito ang magsisilbing opisyal na batayan at pamantayan sa lahat ng pagpapaunlad, pagsubok (testing), at operasyon ng Maintenance Module ng DOMIKNOW.*
