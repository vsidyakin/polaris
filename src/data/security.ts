/* Security and compliance facts, in one module because they appear on eight pages
 * and a figure that drifts between two of them is worse than no figure at all.
 *
 * EVERY STRING HERE IS TRACEABLE to a document in SharePoint › Information Security
 * – Information Security Committee › Shared Documents › Compliance & Regulatory.
 * Nothing is rounded, softened or inferred. Where a document does not say a thing,
 * this file does not say it either — see the notes on TLS and on product scope.
 *
 * ── The scope distinction that everything else depends on ────────────────────────
 * The SOC 2 Type 2 and SOC 3 reports scope themselves in one sentence: the system is
 * the cloud management console, and the report "does not include Mersive's software
 * or hardware based appliances (i.e., Mersive SMART, Mersive Essentials, Mersive
 * Pro)". The ENTITY-LEVEL controls behind those products — secure development,
 * change management, HR screening, risk assessment, vendor management — are audited,
 * because a SOC 2 examines the control environment of the company. The PRODUCTS are
 * not in the attested system boundary.
 *
 * So the site says two true things instead of one convenient one:
 *   • the cloud is attested, and
 *   • the products are independently penetration-tested in their own right.
 * The second is the stronger product claim anyway: a pen test tests the device, and
 * a SOC 2 never would have.
 *
 * ── The 2026 report ─────────────────────────────────────────────────────────────
 * The 2026 ISO set HAS landed (certificate 011964-03 and the Year 2 surveillance
 * report, both 30 June 2026) and is reflected below. The 2026 SOC 2 has NOT: that
 * folder in the drive is still empty. So the ISO markers are retired and the SOC
 * markers stay. Every place the site should name the SOC report carries SEC_2026 in
 * brackets, which the review chrome highlights in yellow, so the set is findable
 * with one search when the PDF lands.
 *
 * ── A constraint the certification body imposes on THIS WEBSITE ─────────────────
 * The surveillance report contains a section titled "Use of Marks and/or Any Other
 * Reference to Certification". BARR inspects our marketing for it every year, and
 * signed off in June 2026 that Mersive:
 *   (f) "Does not allow reference to its management system certification to be used
 *        in such a way as to imply that the certification body certifies a product
 *        (including service) or process"
 *   (g) "Does not imply that the certification applies to activities and sites that
 *        are outside the scope of certification"
 * The scope is the ISMS supporting the Solstice Cloud System. So "the Pod is ISO
 * 27001 certified" is not merely loose copy — it is a finding against us at the next
 * audit. Product-level security claims must rest on the penetration tests, which is
 * what SEC.pen is for. Do not blur the two anywhere on the site.
 */

/** Bracketed marker for anything waiting on the 2026 report. Renders highlighted. */
export const SEC_2026 =
  "[2026 SOC 2 Type 2: swap in the period, the opinion date and the new report link when the auditors issue - CISO]";

export const SEC = {
  /* ── ISO/IEC 27001:2022 ─────────────────────────────────────────────────────
     Certificate of Registration 2026 and Surveillance Year 2 Report, both dated
     30 June 2026. Read 11 Aug 2026. Supersedes certificate 011964-02 of June 2025. */
  iso: {
    standard: "ISO/IEC 27001:2022",
    cert: "011964-03",
    body: "BARR Certifications LLC",
    issued: "30 June 2026",
    registered: "28 June 2024",
    expires: "26 June 2028",
    soa: "statement of applicability v5.0, dated 18 June 2026",
    /* The certificate's own scope wording. It names the Solstice Cloud System, which
       the SOC reports do not — the two frameworks do not describe the same cloud in
       the same words, and that is a question for the auditor rather than for copy. */
    scope:
      "the ISMS supporting the Mersive Collaboration Suite (Solstice Cloud System)",
    virtual:
      "No physical locations were in scope. The scope of Mersive's ISMS operates in a fully virtual environment.",

    /* ── The single strongest sentence available to this website ──────────────
       Surveillance Year 2, audited remotely 22 June 2026 by a three-person BARR
       team over 1.6 on-site-equivalent days. The report tables EIGHTEEN clause
       areas plus Annex A control testing, and every single row reads "Design and
       operating effectiveness met / No comment".

         "There were no open nonconformities identified from the prior year review."
         "BARR Certifications determined Mersive's ISMS continued to fulfill
          requirements between recertification audits."
         "the scope of the ISMS was found to be appropriate and the audit objectives
          of the surveillance review were met"

       Zero nonconformities, major or minor. Compare with the SOC 2, which carries
       one exception. This is the cleaner of the two results and the site has been
       under-selling it. Three opportunities for improvement were raised — remove
       ISO 27701 addendums from policies, keep the nonconformity tracker current,
       and approve policies annually inside the compliance platform — all ISMS
       housekeeping, none a control failure, and OFIs are not findings. They are not
       published because they are not the reader's business; nothing here hides a
       defect, because there is no defect to hide. */
    surveillance:
      "the second annual surveillance audit, completed June 2026, closed with no nonconformities: every ISO 27001 clause and Annex A control testing was assessed as design and operating effectiveness met",
    surveillanceShort: "no nonconformities at the June 2026 surveillance audit",
    /* Annex A.7 physical controls are excluded because there is no Mersive data
       centre to secure — GCP owns the floor. A.8.30 is excluded because there is no
       outsourced development. Both exclusions were re-validated in June 2026, and
       the second one is worth saying out loud: nobody outside Mersive writes this
       product. */
    exclusions:
      "the physical-security controls of Annex A.7 are excluded because customer data sits in Google Cloud, and A.8.30 outsourced development is excluded because there is none",
    /* Sixty people, and the ISMS scope statement covers all of them: "included
       employees who operate in a remote working environment". */
    people: "sixty employees, all inside the ISMS scope",
  },

  /* ── SOC 2 Type 2 / SOC 3 ───────────────────────────────────────────────────
     Both dated 15 July 2025, period 1 Mar – 31 May 2025. Auditor: BARR Advisory,
     P.A. (the attestation) — a different legal entity from BARR Certifications LLC
     (the ISO certificate), and the site should not merge them. */
  soc: {
    auditor: "BARR Advisory, P.A.",
    period: "1 March – 31 May 2025",
    opinionDate: "15 July 2025",
    criteria: "security, confidentiality and availability",
    /* NOT processing integrity, NOT privacy. "Five trust services criteria" would be
       false; three is what was examined, and this file exists partly to stop that
       overclaim.
       BUT: the page should state the three and stop. The old copy said "three, not
       five", which is us volunteering a shortfall nobody asked about — a reviewer who
       knows the framework knows the count, and one who does not has just been taught
       to hold two absent criteria against us. Processing integrity and privacy are
       the criteria for transaction processing and personal-data handling; a session
       broker that does not store workspace content has little to say under either.
       State the three. Do not editorialise. */
    system: "the Polaris cloud management console",
    excluded: "Mersive SMART, Mersive Essentials and Mersive Pro",
    /* Paragraph (d) of the opinion covers 45 C.F.R. §164.308 — the HIPAA Security
       Rule administrative safeguards. This is a HIPAA-mapped SOC 2, not a generic
       one, and it is the single most under-used fact in this file. */
    hipaa:
      "the opinion also covers controls implemented to meet 45 C.F.R. §164.308, the HIPAA Security Rule administrative safeguards",
    /* Section IV carries a control-by-control mapping of NIST SP 800-171 Rev. 2 as
       required by DFARS. */
    dfars:
      "a control-by-control mapping of NIST SP 800-171 Rev. 2, as required by DFARS, is published inside the report",
    /* Section V also carries a mapping to HITRUST CSF v11.5 — found on the re-read of
       12 Aug 2026, and the more useful of the two mappings for healthcare, because
       HITRUST is the framework health systems actually put in their questionnaires.
       Note precisely what this is: a mapping of our SOC 2 controls to the CSF, inside
       the SOC 2 report. It is NOT a HITRUST certification or a CSF assessment, and
       the site must never let those be confused — HITRUST certification is a separate,
       expensive, assessor-led engagement and claiming it would be a serious
       misrepresentation. "Mapped to" is the ceiling here, and it is still worth
       publishing because it saves a healthcare reviewer the translation work. */
    hitrust:
      "the report also maps our controls to HITRUST CSF v11.5, so a healthcare reviewer can read across to the framework their questionnaire is built on",

    /* ── Control counts: the arithmetic, corrected 12 Aug 2026 ─────────────────
       Verified by counting distinct control identifiers in the report: 46 controls
       across 11 families — AC 10, IS 8, CM 6, HR 4, OM 4, RC 4, BC 3, TV 3, CR 2,
       AM 1, SC 1.

       The phrase "No exceptions noted" appears 41 times and "Exceptions noted" once.
       That is 42 test results against 46 controls, because one test procedure can
       cover several controls. So the site must NOT pair "46 controls" with "41 with
       no exceptions" — a reviewer subtracts, gets four unexplained controls, and now
       has a question whose answer is boring but which we made them ask.

       The honest framing is also the stronger one: 46 controls examined, and exactly
       ONE exception in the entire report. That beats "41 of 46 clean" on both counts.

       One further nuance, deliberately not published: on IS-03 the auditor noted that
       the annual policy review happened before the report period, so "this portion of
       the control did not operate and no conclusion was reached regarding its
       operating effectiveness." That is not an exception and not a failure — but it
       does mean the site must not claim that every other control was affirmatively
       tested effective. "One exception" is the claim; "everything else passed" is not. */
    controls: "46 controls across 11 families",
    clean: "one exception in the entire examination",
    /* ── The one exception ──────────────────────────────────────────────────────
       Verbatim from the report: control IS-04, "Management conducts annual employee
       performance evaluations against company objectives." Result: "Five of five
       employees selected for testing did not have a performance evaluation completed
       within the past year." Management's response, also verbatim: "Performance
       evaluations were deferred to align with shifting business priorities. The risk
       was documented, and an exception was approved by the CISO, and HR Leadership,
       in accordance with Mersive's risk management procedures."

       WHAT IT IS TESTED AGAINST MATTERS, and the site should say so rather than let a
       reader imagine the worst. IS-04 maps to CC1.3, CC1.4, CC1.5 and CC2.2 — the
       COSO control-environment principles about competence and accountability. It is
       an HR process control. It is not access control, not encryption, not logging or
       monitoring, not change management, not vulnerability management, not incident
       response. Naming that is accurate AND it is the difference between a reader
       moving on and a reader opening a ticket. */
    exception:
      "a single exception, on the HR control covering annual performance evaluations",
    exceptionContext:
      "it is a people-process control, not a technical one: nothing in access control, encryption, logging, change management, vulnerability management or incident response was excepted",
    soc3:
      "SOC 3 is the general-distribution report and can be published; SOC 2 Type 2 goes out under NDA",
  },

  /* ── Independent penetration testing ────────────────────────────────────────
     Psicurity, four engagements across two calendar years, and the products are in
     three of them. This is why the product pages can make a testing claim the SOC
     report cannot support — and after July 2026 it is the strongest section here.

       Jan 2025  Solstice Cloud            + retest confirming remediation
       Mar 2025  MCS web application       ASVS 4.0.3 L1 · 0 / 0 / 2 / 2
       May 2025  Gen 4 Pod (PDVA)          device assessment
       Jul 2026  MCS + managed Pod (WAVA)  ASVS 5.0.0 L1 + L2 subset · 0 / 0 / 2 / 4

     Two things about the 2026 engagement are worth more than the finding counts.
     First, the bar went UP: ASVS 5.0.0 (May 2025), all Level 1 controls plus a
     subset of Level 2, against 4.0.3 Level 1 the year before. Second, the scope now
     includes the appliance and the WebRTC media path, so the product finally has
     third-party evidence of its own rather than borrowed cloud evidence. */
  pen: {
    firm: "Psicurity",
    standard: "OWASP ASVS 5.0.0",

    /* ── What the 2026 report affirms. Direct quotes, load-bearing. ───────────
       "No Critical or High Severity vulnerabilities were discovered during the
        application tests."
       "Publicly accessible endpoints were assessed for sensitive information
        related to the creator's account and were found to be free of defects."
       "Core security properties held up well under testing: token integrity and
        signature validation, multi-tenant authorization boundaries, injection and
        output-encoding defenses, mass-assignment protection, and client-side
        component currency were all confirmed to be sound." */
    y2026:
      "assessed in July 2026 against OWASP ASVS 5.0.0, every Level 1 control and a subset of Level 2: no critical and no high-severity findings",
    /* ── CORRECTED 12 Aug 2026. Read this before adding anything back. ─────────
       The executive summary of the 2026 report lists "multi-tenant authorization
       boundaries" among the properties "confirmed to be sound". Taken alone that
       sentence supports a tenancy claim. IT DOES NOT SURVIVE THE DETAIL SECTIONS,
       and a claim that dies on page 42 of our own evidence is worse than no claim.

       The detail records a function-level authorization gap on the tenant-selection
       endpoint (V2.3.1, related to V8.2.2): POST /api/organizations/{orgId}/sign-in
       issues a tenant-scoped credential without checking that the caller belongs to
       the organization. "No membership check is performed before the credential is
       issued." The boundary held end-to-end only because the identity provider
       refused to redeem the credential — the assessor's words are that it "held only
       because the identity provider refused to complete a sign-in for a principal
       with no user record in the target tenant. The mcsapi endpoint itself did not
       perform any authorization." And: "any tenant configured to allow [on-the-fly
       user provisioning] would convert this into direct unauthorized cross-tenant
       access."

       So: NO tenancy claim on this site. Not "no cross-tenant access was
       achievable", not "multi-tenant boundaries confirmed sound", not "isolation
       verified by a third party". The list below is trimmed to the properties whose
       detail sections actually pass cleanly, which is still a strong list — V9 token
       handling passed all seven in-scope controls, and object-level authorization on
       templates held under active cross-tenant PATCH and DELETE.

       The tenancy gap is an engineering item, flagged on the Trust Center. It is not
       a website copy problem to phrase around. */
    confirmed:
      "token integrity and signature validation, object-level authorization on tenant-owned records, injection and output-encoding defences, mass-assignment protection and client-side component currency",
    /* V9, verbatim: "All seven in-scope controls pass. Token integrity is enforced
       correctly and uniformly." Signature-break, expiry, token-purpose and audience
       binding all rejected — including a genuine token from a different Firebase
       project signed by the same Google key. That is a real, specific, publishable
       strength and it is not overstated by anything downstream. */
    tokens:
      "every in-scope token-handling control passed: forged, mutated, truncated, expired and foreign-project tokens were all rejected",

    /* ── SCOPE DISCIPLINE ON THE HARDWARE CLAIM. Corrected 12 Aug 2026. ───────
       The July 2026 document is titled "Mersive MCS Application Vulnerability
       Assessment Deliverable" and its methodology section describes mapping and
       testing an application. The Pod appears in it as a NETWORK TARGET — scanned
       from the test segment — not as a device under assessment. The report even
       notes that "the Pod's administrative TLS port was filtered from the test
       segment", so part of the device was not reachable to test.

       The only device-level assessment on file is the Gen 4 Pod PDVA of May 2025,
       which is one engagement, not a cadence.

       Therefore: "the platform is tested annually" is supported. "The hardware is
       tested annually" is NOT, and the earlier copy blurred them. What 2026 supports
       for the hardware is exactly what it says — a network scan that found nothing
       significant exposed. That is worth publishing on its own terms and does not
       need to borrow the word "annual" from the application programme. */

    /* ── The product-level result, and the reason this block exists ───────────
       A full TCP port scan of the managed Pod returned only casting and appliance
       ports (3240, 3463, 5000, 5355, 7000, 7100, 7250, 5895, 8008, 8009, 8800,
       8801, 47000). The UDP scan of the top 200 ports "found no standing service,
       and no STUN, TURN, or DTLS media listener was enumerable, which is consistent
       with the media path using ephemeral, per-session UDP ports that respond only
       after ICE consent."

       In plain terms: there is no permanent media port on the room device for an
       attacker to find. A SOC 2 could never have said this; a port scan can, and
       did. Individual port numbers are deliberately NOT published — a reader gains
       nothing from the list and a scanner gains a head start. */
    pod:
      "network testing of the managed Pod surfaced no significant attack surface: the open ports are the casting and appliance functions, and no persistent media listener was enumerable at all",
    media:
      "the real-time media path uses ephemeral, per-session UDP ports that answer only after ICE consent, so there is no standing media service on the room device to probe",

    /* ── What the 2026 report still finds, and what that forbids in copy ──────
       Two mediums, and they are THE SAME TWO as March 2025, sixteen months on:

         1. Session not revoked server-side at logout (CVSS 6.0). Firebase
            self-contained tokens, no revocation list, no way for a user to see or
            terminate other active sessions.
         2. TLS <= 1.1 negotiable (CVSS 5.9). The edge still enables 3DES,
            static-RSA key transport and CBC-mode suites alongside modern AEAD.

       Four lows: password policy accepts six characters while the interface
       advertises twelve and change-password needs no current password; uploads are
       neither content-validated nor malware-scanned (EICAR was accepted and stored,
       retrievable over an unauthenticated link); the SPA origin sends no CSP or
       frame-ancestors and the API reflects arbitrary Origin values; no rate limiting
       on the analytics endpoint or the unauthenticated WebRTC handshake.

       ┌─ THE HARD RULE FOR THIS SITE ─────────────────────────────────────────┐
       │ Nothing here may claim a minimum TLS version, session revocation on   │
       │ logout, upload malware scanning, a Content-Security-Policy, or that   │
       │ prior findings are remediated. As of 7 July 2026 an independent       │
       │ assessor found otherwise on every one of those, and no retest exists. │
       │ "No critical and no high-severity findings" is true and sufficient.   │
       │                                                                       │
       │ AND, added 13 Aug 2026 from firmware source:                          │
       │ Nothing may claim that CUSTOMER network credentials — the 802.1X       │
       │ certificate and its private-key password — are sealed in the secure    │
       │ element, or that pulling a device does not surrender them.             │
       └───────────────────────────────────────────────────────────────────────┘

       THE SEALED-CREDENTIALS CORRECTION, 13 Aug 2026. Read this before writing
       anything about key custody, because the site got it wrong on ten surfaces
       and the wrong version is more attractive than the right one.

       WHAT IS TRUE, and worth saying:
         The DEVICE'S OWN keys — its identity key and the key that verifies
         firmware updates — exist as SE050 objects whose private material never
         leaves the element. The application asks the element to perform an
         operation rather than holding the key. The channel to the element is
         GlobalPlatform SCP-03, and that channel's keys sit in ARM TrustZone.
         [key_propagation.sh:31-43,115-116 — private material only ever exported
         as reference PEMs]

       WHAT IS FALSE, and was published:
         That the CUSTOMER's 802.1X certificate and key password are sealed
         there. They are not. Customer certificates are written to the
         unencrypted certificate store, and the 802.1X private-key password is a
         NetworkManager system secret.
         [NMGenerators.cpp:148-150,171-173]

       The published sentence "Certificates and key passwords are sealed to the
       pod's onboard secure element rather than stored in configuration, so a
       pulled device doesn't surrender your network credentials" was therefore
       false in its second half and false in the half a network team cares about.
       It is the single most checkable claim on the Trust Center — a reviewer with
       the hardware can disprove it — and it appeared on ten surfaces including a
       printable spec sheet.

       The honest version, which is still a good story: the device's own identity
       is hardware-anchored, and your 802.1X material is protected by secure boot
       and the hardened OS. State the mechanism, not the reassurance.

       ASVS control counts (92 passed of 124) are also not published: 32 failures
       reads as a catastrophe out of context and as noise in it, since ASVS L2 is a
       standard almost nothing passes wholesale and the report says so itself —
       "Failed findings do not always result in a vulnerability." */
    counts2026: "0 critical · 0 high · 2 medium · 4 low · 0 informational",

    /* ── THE DEVICE ASSESSMENT. Read 12 Aug 2026, in full. ───────────────────────
       "Mersive Physical Device Vulnerability Assessment", Psicurity, work begun
       26 March 2025, delivered 12 May 2025. Products tested: Gen 4 Pod AND Gen 4 Pod
       Mini — both, which matters because it gives the smaller tier its own evidence
       rather than making it borrow the Pod's.

       This is the best security document Mersive holds, and until now the site had a
       placeholder where its result should be. The Results Summary, verbatim:

         "Analysts were unable to gain access to any critical assets or data contained
          within the device. Furthermore, no Critical, High, Medium, or Low Severity
          vulnerabilities were identified on the targeted devices. Mersive has
          architected the device to be resilient against realistic threats and attacks
          that were tested by Psicurity. This is not to say that compromise is
          impossible, but it would require a significant level of effort that only a
          very skilled adversary would present."

       Zero at every severity. The only entry in the findings section is FINDING 1,
       Service Detection, rated INFORMATIONAL — the observation that HTTP service
       banners identify themselves.

       THE THREAT MODEL IS WHY THIS IS WORTH SO MUCH. Not a remote attacker: "someone
       with technical skills who has physical access to the devices and public
       documentation", without sophisticated hardware debugging equipment. The stated
       goal was "to gain logical access to a device and compromise it, so that it may
       be used as a man-in-the-middle or snooping agent without evidence of tampering."
       They had the box on the bench, opened it, and did not get there.

       What they tried, and what held:
         • UART over the debug header: reachable, but "an interactive login with the
           root user is not allowed, and an opportunity to enter a password is never
           presented", and no other working credentials were discoverable.
         • JTAG: the header is a 1.0mm 1x8 wafer connector, too small for standard
           probes and hard to source; desoldering failed; even with a harness Mersive
           supplied, the J-Link would not negotiate.
         • Firmware extraction: the 32GB flash is a ball grid array, "extremely
           difficult to interact with outside of JTAG".
         • Network MITM in a lab: an invalid certificate was presented to the Pod. "The
           POD did not honor this invalid certificate, which resulted in a failure of
           the TLS handshake, and halting of communications with Mersive servers."

       THE HONEST LIMITS, and the site respects all three:
         1. "No vulnerabilities identified" is not "unbreakable", and the report says so
            in its own next sentence. Copy carries that nuance rather than absolutising.
         2. "All of the identifiable listening services are over unencrypted channels",
            and the assessor recommends moving them to TLS. So NO claim that everything
            on the device is encrypted. The certificate-validation claim below is
            specifically about the device's link to Mersive servers, which is what was
            tested, and it is written that way.
         3. This is May 2025 on Gen 4 hardware. Gen 4 Pod / Pod Mini to Polaris Pro /
            Essentials naming is already flagged on both product pages. */
    device:
      "the Gen 4 Pod and Pod Mini were both assessed by an outside firm with the hardware in hand, and no critical, high, medium or low-severity vulnerabilities were identified on either device",
    deviceModel:
      "the tester was modelled as someone with technical skill, physical access to the device and the public documentation, whose goal was to gain logical access and turn the device into a man-in-the-middle or snooping agent without leaving evidence of tampering",
    deviceResult:
      "they could not reach any critical asset or data on the device: root login over the debug interface is refused outright with no password prompt offered, no other working credentials were found, and the firmware could not be extracted",
    /* Verbatim: "The in-scope devices were not observed to store any Personally
       Identifiable Information (PII)." Third-party-verified, and it is the first
       question a privacy reviewer asks about a box in a shared room. */
    devicePii:
      "no personally identifiable information was found stored on either device",
    deviceMitm:
      "presented with an invalid certificate in a lab man-in-the-middle attempt, the Pod refused it, failed the handshake and stopped talking to Mersive rather than trusting the interceptor",
    /* The assessor identified the SoC as a MediaTek MT8395 and noted it "contains
       SecureBoot functionality" — outside confirmation of a claim the product pages
       have been making on our own authority. */
    deviceBoot:
      "the assessor independently identified the MediaTek MT8395 SoC and its secure-boot capability",

    solstice:
      "Solstice Cloud, assessed in January 2025 with a retest report on file confirming remediation",
    /* The SOC 2 commits to this in the system description, so the cadence is an
       audited commitment rather than a marketing habit — and the four engagements
       above are the evidence that it is kept. */
    cadence:
      "annual third-party penetration testing is a commitment inside the SOC 2 report, not a marketing line, and four engagements across 2025 and 2026 are on file",
  },

  /* ── The policy set the Security Committee approves annually ────────────────
     Named in the SOC description. Fourteen, and naming them is more persuasive than
     claiming "comprehensive policies". */
  policies: [
    "Access control",
    "Asset management",
    "Business continuity and disaster recovery",
    "Code of conduct",
    "Cryptography",
    "Data management",
    "HR security",
    "Incident response",
    "Information security",
    "Information security roles and responsibilities",
    "Operations security",
    "Risk management",
    "Secure development",
    "Third-party management",
  ],

  /* ── Infrastructure, as the SOC description states it ──────────────────────── */
  infra: {
    host: "Google Cloud",
    net: "firewall rules and access controls",
    transit: "TLS from a public certificate authority",
    admin: "administrative access behind IAM and multi-factor authentication",
    ha: "failover across multiple availability zones",
  },

  /* ── Data classification, from the audited data-management policy ───────────
     Stronger and more specific than "we don't sell your data", and it is the answer
     to the question a CISO actually asks. */
  data: {
    confidential:
      "room names, session names, device metadata, operating-system information and anonymised usage data are all classified Confidential",
    levels: "Confidential, Restricted and Public, with Restricted the default",
  },
} as const;

/** One-line certification summary, for cards and pillars that have no room for the
 *  full scope statement. Deliberately says "cloud" rather than "platform", and
 *  deliberately gives the products their own clause — see the mark-usage note at the
 *  top of this file, which makes that separation a certification requirement rather
 *  than a stylistic choice. */
export const SEC_SUMMARY =
  `${SEC.iso.standard} certified with no nonconformities at the June 2026 surveillance audit, SOC 2 Type 2 attested for the Polaris cloud, and the room device assessed by a third party in its own right.`;

/** The two-sentence version for a security reviewer skimming for the shape of the
 *  evidence rather than the detail. Leads with the ISO result because it is the
 *  cleanest one we hold. */
export const SEC_PILLAR =
  `An independent certification body audited the information security management system in June 2026 and raised no nonconformities: every clause of ISO/IEC 27001:2022 and the Annex A control testing came back as design and operating effectiveness met. The cloud is separately SOC 2 Type 2 attested, and the room device is assessed by a third party in its own right, most recently scanned in July 2026 with no significant network attack surface found.`;
