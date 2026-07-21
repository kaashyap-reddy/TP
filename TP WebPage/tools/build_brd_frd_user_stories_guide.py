from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem, NextPageTemplate
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "BRD_vs_FRD_vs_User_Stories_BA_Training_Application.pdf"

NAVY = HexColor("#12324A")
BLUE = HexColor("#1677A6")
CYAN = HexColor("#DDF4FA")
TEAL = HexColor("#0A7F78")
GREEN = HexColor("#E3F3EC")
AMBER = HexColor("#F6B73C")
PALE_AMBER = HexColor("#FFF4D8")
RED = HexColor("#B64A4A")
PALE_RED = HexColor("#FBE8E6")
INK = HexColor("#22313F")
MUTED = HexColor("#5F6E78")
LIGHT = HexColor("#EEF3F5")
WHITE = colors.white


def register_fonts():
    candidates = [
        ("Aptos", Path("C:/Windows/Fonts/aptos.ttf"), Path("C:/Windows/Fonts/aptosbd.ttf")),
        ("Arial", Path("C:/Windows/Fonts/arial.ttf"), Path("C:/Windows/Fonts/arialbd.ttf")),
    ]
    for name, regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont(name, str(regular)))
            pdfmetrics.registerFont(TTFont(name + "-Bold", str(bold)))
            return name, name + "-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()


class GuideDocTemplate(BaseDocTemplate):
    def __init__(self, filename, **kw):
        super().__init__(filename, **kw)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height,
                      id="content", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=self._header_footer))

    def _header_footer(self, canvas, doc):
        canvas.saveState()
        w, h = A4
        if doc.page > 1:
            canvas.setStrokeColor(HexColor("#D3DEE4"))
            canvas.setLineWidth(0.5)
            canvas.line(18 * mm, h - 14 * mm, w - 18 * mm, h - 14 * mm)
            canvas.setFont(FONT, 8)
            canvas.setFillColor(MUTED)
            canvas.drawString(18 * mm, h - 10.5 * mm, "BA PRACTITIONER GUIDE")
            canvas.drawRightString(w - 18 * mm, h - 10.5 * mm, "BRD | FRD | USER STORIES")
            canvas.line(18 * mm, 13 * mm, w - 18 * mm, 13 * mm)
            canvas.drawString(18 * mm, 8.5 * mm, "Trainee Portal - working training reference")
            canvas.drawRightString(w - 18 * mm, 8.5 * mm, f"{doc.page}")
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style = flowable.style.name
            if style in ("H1", "H2"):
                level = 0 if style == "H1" else 1
                text = flowable.getPlainText()
                key = f"h{level}-{self.seq.nextf('heading')}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)
                self.notify("TOCEntry", (level, text, self.page, key))


styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", fontName=FONT_BOLD, fontSize=11, leading=14,
                          textColor=BLUE, spaceAfter=10, tracking=1.4))
styles.add(ParagraphStyle(name="CoverTitle", fontName=FONT_BOLD, fontSize=30, leading=34,
                          textColor=NAVY, spaceAfter=12))
styles.add(ParagraphStyle(name="CoverSub", fontName=FONT, fontSize=14, leading=20,
                          textColor=MUTED, spaceAfter=18))
styles.add(ParagraphStyle(name="H1", fontName=FONT_BOLD, fontSize=20, leading=24,
                          textColor=NAVY, spaceBefore=2, spaceAfter=10, keepWithNext=True))
styles.add(ParagraphStyle(name="H2", fontName=FONT_BOLD, fontSize=14, leading=18,
                          textColor=BLUE, spaceBefore=10, spaceAfter=6, keepWithNext=True))
styles.add(ParagraphStyle(name="H3", fontName=FONT_BOLD, fontSize=11, leading=14,
                          textColor=TEAL, spaceBefore=7, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name="BodyX", fontName=FONT, fontSize=9.4, leading=13.3,
                          textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", fontName=FONT, fontSize=7.7, leading=10.5,
                          textColor=INK, spaceAfter=3))
styles.add(ParagraphStyle(name="Tiny", fontName=FONT, fontSize=6.7, leading=8.5,
                          textColor=INK))
styles.add(ParagraphStyle(name="TableHead", fontName=FONT_BOLD, fontSize=7.6, leading=9.5,
                          textColor=WHITE))
styles.add(ParagraphStyle(name="TableCell", fontName=FONT, fontSize=7.2, leading=9.2,
                          textColor=INK))
styles.add(ParagraphStyle(name="TableCellBold", fontName=FONT_BOLD, fontSize=7.2, leading=9.2,
                          textColor=NAVY))
styles.add(ParagraphStyle(name="CalloutTitle", fontName=FONT_BOLD, fontSize=9.5, leading=12,
                          textColor=NAVY, spaceAfter=3))
styles.add(ParagraphStyle(name="CalloutBody", fontName=FONT, fontSize=8.4, leading=11.5,
                          textColor=INK))
styles.add(ParagraphStyle(name="Story", fontName=FONT_BOLD, fontSize=10.5, leading=14,
                          textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="Quote", fontName=FONT, fontSize=9, leading=13,
                          leftIndent=10, borderColor=BLUE, borderWidth=0, borderPadding=7,
                          textColor=INK, backColor=CYAN, spaceAfter=7))
styles.add(ParagraphStyle(name="Source", fontName=FONT, fontSize=7.2, leading=9.5,
                          textColor=MUTED, spaceAfter=4))


def P(text, style="BodyX"):
    return Paragraph(text, styles[style])


def bullets(items, level=0, style="BodyX"):
    return ListFlowable(
        [ListItem(P(item, style), leftIndent=10) for item in items],
        bulletType="bullet", start="circle", leftIndent=14 + level * 8,
        bulletFontName=FONT, bulletFontSize=6.5, bulletColor=TEAL,
        spaceBefore=1, spaceAfter=5,
    )


def numbered(items):
    return ListFlowable(
        [ListItem(P(item, "BodyX"), leftIndent=12) for item in items],
        bulletType="1", leftIndent=18, bulletFontName=FONT_BOLD,
        bulletFontSize=8, bulletColor=BLUE, spaceAfter=6,
    )


def table(headers, rows, widths, head=NAVY, font_size=None):
    h = [P(x, "TableHead") for x in headers]
    rr = [[P(str(x), "TableCell") for x in row] for row in rows]
    t = Table([h] + rr, colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), head),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, HexColor("#CBD7DD")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for i in range(1, len(rows) + 1):
        commands.append(("BACKGROUND", (0, i), (-1, i), WHITE if i % 2 else HexColor("#F6F9FA")))
    t.setStyle(TableStyle(commands))
    return t


def callout(title, body, color=CYAN, stripe=BLUE):
    inner = Table([[P(title, "CalloutTitle")], [P(body, "CalloutBody")]], colWidths=[155 * mm])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("BOX", (0, 0), (-1, -1), 0.4, HexColor("#CBD7DD")),
        ("LINEBEFORE", (0, 0), (0, -1), 4, stripe),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
    ]))
    return inner


def section(title, kicker=None):
    out = [P(title, "H1")]
    if kicker:
        out += [P(kicker, "Quote")]
    out += [HRFlowable(width="100%", thickness=1, color=HexColor("#C8D7DE"), spaceAfter=8)]
    return out


def story_block(sid, title, story, criteria, notes=None):
    elements = [P(f"{sid} - {title}", "H3"), P(story, "Story")]
    elements.append(P("Acceptance criteria", "TableCellBold"))
    elements.append(bullets(criteria, style="Small"))
    if notes:
        elements.append(P(f"<b>BA note:</b> {notes}", "Small"))
    return KeepTogether(elements)


def add_cover(story):
    story += [Spacer(1, 22 * mm), P("BUSINESS ANALYSIS LEARNING PACK", "CoverKicker")]
    story += [P("BRD vs FRD vs<br/>User Stories", "CoverTitle")]
    story += [P("An in-depth, practical guide tailored to the BA Training Application (Trainee Portal)", "CoverSub")]
    story += [Spacer(1, 5 * mm)]
    story += [callout(
        "One need, three views",
        "<b>BRD:</b> why the change matters and what business outcome is required.<br/>"
        "<b>FRD:</b> what the solution must do and under which rules.<br/>"
        "<b>User story:</b> a small, negotiable slice of user value used to plan delivery and prompt conversation.",
        color=CYAN, stripe=BLUE
    )]
    story += [Spacer(1, 15 * mm)]
    meta = Table([
        [P("APPLICATION", "TableCellBold"), P("Internal Trainee Management Portal", "TableCell")],
        [P("ROLES", "TableCellBold"), P("Admin, Facilitator, Trainee", "TableCell")],
        [P("PERSPECTIVE", "TableCellBold"), P("As-is implementation plus recommended BA documentation practice", "TableCell")],
        [P("VERSION", "TableCellBold"), P("1.0 - 20 July 2026", "TableCell")],
    ], colWidths=[34 * mm, 121 * mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), LIGHT), ("GRID", (0, 0), (-1, -1), .4, HexColor("#CBD7DD")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [meta, Spacer(1, 11 * mm), P("Prepared as a learning and working reference. It is not a signed-off BRD or FRD.", "Source"), PageBreak()]


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = GuideDocTemplate(str(OUT), pagesize=A4, rightMargin=18 * mm, leftMargin=18 * mm,
                           topMargin=19 * mm, bottomMargin=18 * mm,
                           title="BRD vs FRD vs User Stories",
                           author="Business Analysis Training",
                           subject="Requirements documentation guide tailored to the Trainee Portal",
                           keywords="BRD, FRD, user stories, business analysis, Trainee Portal")
    story = []
    add_cover(story)

    story += section("How to use this guide", "Read Sections 1-3 for concepts; Sections 4-7 for Trainee Portal examples; Sections 8-10 for day-to-day BA practice.")
    story += [P("This guide answers four practical questions: what each artifact is, how they relate, what good content looks like, and how to apply them to the implemented Trainee Portal.")]
    story += [P("Document status", "H2"), callout("Evidence basis", "Application-specific examples were derived from the repository's implemented roles, routes, business rules, data model, user flows, and existing FRD workflow. Where the guide recommends future metrics or governance, it labels them as proposed rather than implemented.", GREEN, TEAL)]
    story += [P("Choose your reading path", "H2")]
    story += [table(["If you need to...", "Go to"], [
        ["Explain the difference quickly", "Sections 1-2"],
        ["Draft or review a business case and scope", "Sections 3-4 and Appendix A.1"],
        ["Specify buildable, testable behavior", "Sections 3 and 5; Appendix A.2"],
        ["Write sprint-ready stories and criteria", "Sections 6-7 and Appendix A.3"],
        ["Connect requirements to tests and manage change", "Sections 8-10"],
    ], [90*mm,67*mm])]
    story += [P("Learning outcomes", "H2"), bullets([
        "Select an artifact based on decision need, audience, risk and delivery method.",
        "Move from business outcome to functional behavior to story and acceptance evidence.",
        "Recognize ambiguity, missing rules, false metrics and weak authorization requirements.",
        "Apply reusable examples and templates to the BA Training Application.",
    ], style="Small")]
    story += [P("Contents", "H2")]
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(name="TOC0", fontName=FONT_BOLD, fontSize=9.5, leading=13, leftIndent=0, textColor=NAVY, spaceBefore=4),
        ParagraphStyle(name="TOC1", fontName=FONT, fontSize=8.2, leading=11, leftIndent=12, textColor=INK),
    ]
    story += [toc, PageBreak()]

    story += section("1. The core idea: requirements at different altitudes", "The artifacts are complementary, not competitors. They answer different questions and serve different decisions.")
    story += [P("A business need begins at outcome level, is refined into solution behavior, and is then sliced into deliverable increments. Traceability should work in both directions: every story should support a functional and business requirement; every approved business requirement should be covered by solution requirements and delivery items.")]
    altitude = table(
        ["Altitude", "Primary question", "Typical expression", "Portal example"],
        [
            ["Business", "Why change? What outcome and value?", "BRD / business requirements", "Reduce manual effort and scheduling errors when a new cohort is launched."],
            ["Stakeholder", "What do affected people need?", "Stakeholder needs, process models", "Admin needs to create a complete cohort schedule from a standard plan."],
            ["Solution", "What capability or quality must exist?", "FRD, models, rules, NFRs", "On batch creation, copy template content and calculate working-day dates."],
            ["Delivery", "What small slice can the team build and verify?", "Epic, user story, acceptance criteria", "As an Admin, I want to create a batch from a plan so setup is completed in one action."],
            ["Verification", "How do we prove it works?", "Examples, tests, UAT evidence", "Given a Saturday start, first session is scheduled on Monday."],
        ], [25*mm, 40*mm, 42*mm, 48*mm]
    )
    story += [altitude, Spacer(1, 7), callout("Standards nuance", "BABOK uses a requirements classification schema - business, stakeholder, solution (functional and non-functional), and transition requirements. BRD and FRD are widely used document labels, but their exact names and boundaries vary by organization. Define your team's artifact convention before judging whether a requirement is in the 'right document'.", PALE_AMBER, AMBER)]
    story += [P("Requirement chain", "H2")]
    chain = Table([[P("Business outcome", "TableCellBold"), P("->", "TableCellBold"), P("Stakeholder need", "TableCellBold"), P("->", "TableCellBold"), P("Functional behavior", "TableCellBold"), P("->", "TableCellBold"), P("Story + criteria", "TableCellBold"), P("->", "TableCellBold"), P("Test / evidence", "TableCellBold")]], colWidths=[29*mm,6*mm,29*mm,6*mm,31*mm,6*mm,31*mm,6*mm,29*mm])
    chain.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),CYAN),("BOX",(0,0),(-1,-1),.5,BLUE),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),8)]))
    story += [chain, PageBreak()]

    story += section("2. BRD vs FRD vs user stories - detailed comparison")
    rows = [
        ["Purpose", "Align on problem, outcomes, scope, value and constraints.", "Specify solution behavior, rules, data, interfaces, errors and qualities.", "Plan and discuss a small user-valued increment."],
        ["Primary reader", "Sponsor, business owner, SMEs, product lead, BA, governance.", "BA, product owner, architects, developers, QA, operations.", "Product owner, delivery team, QA and the relevant stakeholder."],
        ["Time horizon", "Initiative / release / capability.", "System or feature through design, build and test.", "Usually one sprint-sized backlog item."],
        ["Focus", "Why and what outcome; solution-independent where possible.", "What the solution shall do; enough precision to build and test.", "Who needs what and why, plus conditions of satisfaction."],
        ["Typical content", "Problem, objectives, KPIs, stakeholders, scope, high-level requirements, assumptions, risks.", "Actors, flows, functions, rules, data, permissions, validations, errors, interfaces, NFRs.", "Title, persona, goal, benefit, acceptance criteria, dependencies, notes."],
        ["Detail", "Broad and outcome-oriented.", "Detailed and behavior-oriented.", "Narrow, just enough for conversation and delivery."],
        ["Approval", "Business sponsor / product governance.", "Product owner plus technical, QA, security or operations reviewers as relevant.", "Product owner accepts; team refines collaboratively."],
        ["Change control", "Formal for baselined scope/outcomes; impact assessed.", "Versioned and traced; may be formal or backlog-driven.", "Continuously refined, split, reordered or removed."],
        ["Common failure", "Becomes a feature wish list without measurable outcomes.", "Becomes screen design or misses rules and exceptions.", "Becomes a mini-spec, task, or vague placeholder."],
    ]
    story += [table(["Dimension", "BRD", "FRD", "User story"], rows, [25*mm,44*mm,44*mm,44*mm])]
    story += [P("They can coexist in Agile", "H2"), P("Agile does not mean 'no documentation.' It favors useful, evolving documentation and frequent feedback. A concise BRD can frame outcomes and scope; a living FRD or linked models can hold cross-cutting detail; stories can sequence delivery. The amount of formality should follow risk, team size, regulatory needs, vendor boundaries, and change cost.")]
    story += [callout("Do not force a false choice", "Use the lightest set that preserves shared understanding and traceability. A small internal enhancement may need one problem statement and a handful of stories. A multi-role portal with permissions, scheduling rules, file handling and auditability benefits from a durable functional reference plus backlog stories.", GREEN, TEAL), PageBreak()]

    story += section("3. What good looks like")
    story += [P("Quality of an individual requirement", "H2")]
    story += [bullets([
        "Necessary: traces to a real need, goal, risk, policy or stakeholder outcome.",
        "Clear and singular: expresses one main obligation using consistent terms.",
        "Feasible: achievable within known technical, legal, operational and budget constraints.",
        "Verifiable: has an observable result, threshold, rule or example.",
        "Unambiguous: avoids subjective terms such as intuitive, fast, appropriate or user-friendly unless quantified.",
        "Implementation-aware but not prematurely prescriptive: state a mandated design only when it is genuinely constrained.",
        "Traceable and uniquely identified: source, owner, priority, status and downstream coverage are visible.",
    ])]
    story += [P("Quality of a requirement set", "H2")]
    story += [bullets([
        "Complete for the agreed scope: happy path, alternatives, errors, roles, rules, data and quality needs are covered.",
        "Consistent: no conflicts in terminology, permissions, dates, statuses or calculations.",
        "Prioritized: business value, risk and dependency are separated from delivery estimate.",
        "Modifiable: structured so one change does not require edits in many uncontrolled copies.",
        "Balanced: functional requirements are accompanied by security, performance, accessibility, privacy, support and audit needs where relevant.",
    ])]
    story += [P("Good wording patterns", "H2")]
    story += [table(["Weak", "Stronger", "Why stronger"], [
        ["The system should be fast.", "The batch list shall return the first page within the agreed performance threshold at the expected concurrent load.", "Names the transaction and leaves a measurable threshold to be agreed."],
        ["Admin can create batches.", "When an Admin submits valid batch details, the system shall create one batch and instantiate the selected plan in a single transaction.", "Defines actor, trigger, outcome and atomicity."],
        ["Notify users.", "When an announcement becomes visible to an eligible user, the system shall include it in that user's notification feed and preserve per-user read state.", "Clarifies event, audience, channel and state."],
    ], [42*mm,75*mm,40*mm])]
    story += [callout("Use 'shall' deliberately", "In a formal baseline, 'shall' identifies an obligation. In a product backlog, plain language is fine if the condition is still testable. Consistency matters more than ceremony.", CYAN, BLUE), PageBreak()]

    story += section("4. BRD applied to the BA Training Application", "This is a concise example of what the initiative-level business view could contain.")
    story += [P("4.1 Business context and problem", "H2")]
    story += [P("Training operations must coordinate standardized curricula, cohort schedules, facilitators, trainees, assignments, attendance, resources, announcements and feedback. Manual setup across spreadsheets, calendars and messages can duplicate effort, create inconsistent schedules, weaken visibility and make evidence difficult to retrieve.")]
    story += [P("4.2 Proposed business objective", "H2")]
    story += [P("Provide one role-based portal that standardizes the creation and operation of BA training cohorts while keeping each live batch independently manageable and giving trainees a clear view of their learning obligations and progress.")]
    story += [P("4.3 Stakeholders", "H2")]
    story += [table(["Stakeholder", "Interest / decision", "Portal need"], [
        ["Sponsor / training leadership", "Value, adoption, risk and operational performance", "Reliable metrics, controlled scope and transparent outcomes"],
        ["Admin", "Program setup and governance", "Plans, batches, users, audit, reports and global communication"],
        ["Facilitator", "Deliver training and support learners", "Owned batches, sessions, attendance, grading, resources and feedback"],
        ["Trainee", "Complete learning activities", "Schedule, assignments, submissions, resources, feedback and progress"],
        ["IT / operations", "Availability, support, security and recoverability", "Deployable, observable and maintainable service"],
        ["Compliance / information security", "Access, retention, privacy and audit", "Least privilege, protected files and traceable actions"],
    ], [35*mm,58*mm,64*mm])]
    story += [P("4.4 Business objectives and proposed measures", "H2")]
    story += [table(["Objective", "Proposed KPI", "Baseline / target decision"], [
        ["Reduce cohort setup effort", "Median admin time from approved cohort request to ready batch", "Measure current manual baseline; sponsor sets target"],
        ["Reduce scheduling defects", "Count of corrections caused by generated date/time errors", "Target should distinguish template changes from defects"],
        ["Improve delivery visibility", "% active cohorts with current attendance, assignment and feedback status", "Define freshness window and accountable owner"],
        ["Improve learner completion", "% assignments submitted by deadline and completion by cohort", "Segment by plan and cohort; avoid punitive use without context"],
        ["Strengthen governance", "% material actions represented in audit evidence", "Define material action catalogue and retention period"],
    ], [48*mm,66*mm,43*mm])]
    story += [callout("Important", "These KPIs are recommended measures, not verified commitments in the current application. A BA should baseline them, agree definitions and obtain sponsor approval before putting numeric targets into a BRD.", PALE_AMBER, AMBER), PageBreak()]

    story += section("4. BRD example - scope, requirements and risks")
    story += [P("4.5 In scope / out of scope", "H2")]
    story += [table(["In scope", "Out of scope or external dependency"], [
        ["Role-based access for Admin, Facilitator and Trainee", "Learning content authoring beyond plan/session/resource metadata"],
        ["Two standard BA plans and per-batch instantiation", "Payroll, HR performance management and certification issuance"],
        ["Cohort roster, schedule, assignments, submissions and grading", "Video conferencing platform or virtual classroom engine"],
        ["Attendance, resources, announcements and feedback tracking", "Authoring or hosting external survey forms"],
        ["Reports, notifications and audit evidence", "Production email/S3/hosting procurement decisions"],
    ], [78.5*mm,78.5*mm])]
    story += [P("4.6 Example business requirements", "H2")]
    brs = [
        ["BR-01", "The organization shall operate BA cohort training through one controlled portal for all three roles.", "Sponsor"],
        ["BR-02", "The organization shall standardize cohort setup using approved BA BTech and BA MBA plans.", "Training owner"],
        ["BR-03", "A live cohort shall remain independently editable without changing the source training plan.", "Training owner"],
        ["BR-04", "Users shall see only information and actions appropriate to their role and cohort relationship.", "Security / business owner"],
        ["BR-05", "The program shall maintain evidence of material administrative and learning operations.", "Governance"],
        ["BR-06", "Trainees shall have a consolidated view of schedule, work, resources, feedback and progress.", "Learner experience owner"],
        ["BR-07", "Facilitators shall manage delivery only for cohorts they own unless elevated authority is granted.", "Training owner"],
        ["BR-08", "The solution shall support operational continuity through deployable storage, database, email and monitoring capabilities.", "IT operations"],
    ]
    story += [table(["ID", "Business requirement", "Primary owner"], brs, [18*mm,104*mm,35*mm])]
    story += [P("4.7 Assumptions, constraints and risks", "H2")]
    story += [table(["Type", "Example", "BA action"], [
        ["Assumption", "Training occurs Monday-Friday; standard daily session time is 2:30-4:30 PM.", "Validate with training leadership and record exceptions."],
        ["Constraint", "Exactly two approved training plans are available in the current solution.", "Treat change as scope and data migration impact."],
        ["Dependency", "External form links are manually created and attached.", "Define owner, availability expectation and fallback."],
        ["Risk", "Incorrect role or cohort scoping could expose personal or performance data.", "Prioritize authorization rules and negative tests."],
        ["Risk", "Template changes may be assumed to update live batches.", "Communicate copy-on-create behavior in UI, training and acceptance criteria."],
        ["Risk", "Metrics can be misread if data is incomplete or stale.", "Define calculations, freshness, null behavior and data owner."],
    ], [25*mm,77*mm,55*mm]), PageBreak()]

    story += section("5. FRD applied to the BA Training Application", "The FRD translates business intent into precise, testable system behavior. It should cover behavior and rules, not only screens.")
    story += [P("5.1 Recommended FRD structure", "H2")]
    story += [numbered([
        "Purpose, scope, document status, terms and references.",
        "Actors, permissions and stakeholder context.",
        "System context, assumptions, external systems and data boundaries.",
        "Process flows, states and exception paths.",
        "Numbered functional requirements grouped by capability.",
        "Business rules and calculations separated from UI wording.",
        "Data definitions, validations, retention and audit needs.",
        "Interfaces, file handling, notifications and error behavior.",
        "Non-functional requirements or explicit cross-reference to an NFR specification.",
        "Traceability, open decisions, acceptance approach and sign-off history.",
    ])]
    story += [P("5.2 Example functional requirements", "H2")]
    frs = [
        ["FR-01", "Authentication", "The system shall authenticate an active user and route the user to the portal associated with the assigned role.", "BR-01, BR-04"],
        ["FR-02", "Batch creation", "When an Admin provides a unique batch name, plan and start date, the system shall create the batch and its plan-derived content in one transaction.", "BR-02"],
        ["FR-03", "Scheduling", "The system shall map plan day offsets to Monday-Friday working dates; a weekend start shall roll to Monday.", "BR-02"],
        ["FR-04", "Isolation", "After instantiation, editing a batch session, assignment, resource or announcement shall not modify the source plan.", "BR-03"],
        ["FR-05", "Authorization", "A Facilitator shall access batch management actions only for assigned batches; a Trainee shall access cohort content only for enrolled batches.", "BR-04, BR-07"],
        ["FR-06", "Submission", "The system shall preserve one current submission per trainee and assignment while retaining superseded attachment history.", "BR-05, BR-06"],
        ["FR-07", "Deadline", "The system shall allow a first late submission but shall block resubmission after the assignment deadline.", "BR-06"],
        ["FR-08", "Feedback", "The system shall expose session or assignment feedback links only to the configured audience and record one completion marker per eligible user.", "BR-04, BR-05"],
        ["FR-09", "Announcements", "The system shall show global and eligible batch announcements and maintain read state independently for each user.", "BR-05, BR-06"],
        ["FR-10", "Audit", "The system shall append an audit record for defined material actions without changing earlier audit entries.", "BR-05"],
    ]
    story += [table(["ID", "Area", "Requirement", "Trace"], frs, [17*mm,26*mm,87*mm,27*mm])]
    story += [Spacer(1,6), callout("Functional vs non-functional", "A functional requirement describes behavior or capability. A non-functional requirement describes a quality or constraint, such as response time, availability, accessibility, security or recoverability. Both are solution requirements in BABOK terminology; both must be testable.", GREEN, TEAL), PageBreak()]

    story += section("5. FRD deep dive - a complete feature slice")
    story += [P("Feature: create a batch from a training plan", "H2")]
    story += [table(["Field", "Example specification"], [
        ["Trigger", "Admin selects Create Batch and submits valid values."],
        ["Inputs", "Batch name; training plan; start date; optional facilitator; optional roster."],
        ["Preconditions", "Admin is authenticated; selected plan is active and readable; batch name passes uniqueness rule."],
        ["Main outcome", "Batch is created with its own sessions, assignments, resources, announcements and feedback links copied from the selected plan."],
        ["Scheduling rule", "Use working-day offsets. Skip Saturday and Sunday. Standard session time is 14:30-16:30. Assignment due time is 23:59."],
        ["Transaction rule", "Failure in any mandatory creation step rolls back the entire batch creation."],
        ["Isolation rule", "Copied records retain origin references for traceability but are independently editable."],
        ["Alternative", "If facilitator is omitted, create an unassigned batch; do not silently assign the Admin."],
        ["Roster alternative", "If no roster is supplied, batch creation succeeds and enrollment can occur later."],
        ["Validation errors", "Missing/invalid fields return field-specific feedback; duplicate batch name does not create partial records."],
        ["Audit", "Record actor, time, created batch, selected plan and outcome."],
        ["Postcondition", "Admin can open the new batch and view the generated schedule and work items."],
    ], [36*mm,121*mm])]
    story += [P("Decision table: start date", "H2")]
    story += [table(["Entered date", "First working date", "Expected behavior"], [
        ["Monday-Friday", "Same date", "Schedule Day 1 on entered date."],
        ["Saturday", "Following Monday", "Roll forward; do not create weekend session."],
        ["Sunday", "Following Monday", "Roll forward; do not create weekend session."],
        ["Invalid / absent", "None", "Reject request with field-level validation; create nothing."],
    ], [37*mm,42*mm,78*mm])]
    story += [P("Example NFRs to agree", "H2")]
    story += [bullets([
        "Performance: define a percentile response threshold and expected data/concurrency profile for batch creation and list views.",
        "Security: enforce authorization server-side; protect refresh tokens; validate uploads and URLs; avoid sensitive token exposure in production.",
        "Reliability: batch instantiation is atomic and idempotency behavior is agreed for retried requests.",
        "Accessibility: agree target standard and test keyboard, focus, labels, contrast and error identification.",
        "Audit and retention: identify material events, protected fields, retention duration and export needs.",
        "Recovery: agree backup frequency, recovery point objective and recovery time objective for production data and files.",
    ]), PageBreak()]

    story += section("6. User stories in depth", "A user story is not merely a sentence template. It is a token for conversation, backed by examples and acceptance criteria.")
    story += [P("6.1 Anatomy", "H2")]
    story += [P("<b>As a</b> [specific user or stakeholder], <b>I want</b> [goal or capability], <b>so that</b> [business or user value].", "Quote")]
    story += [table(["Element", "Good practice", "Portal example"], [
        ["Persona", "Use a meaningful role, not 'user'.", "Admin responsible for cohort setup"],
        ["Goal", "Describe the outcome, not a UI control.", "Create a cohort from an approved plan"],
        ["Benefit", "Make value explicit; challenge stories with weak value.", "Avoid rebuilding the curriculum manually"],
        ["Conversation", "Record rules, examples, data and open questions without turning the story into a contract.", "Weekend dates, optional trainer, rollback"],
        ["Confirmation", "Acceptance criteria define story-specific success.", "No partial batch remains after a copy failure"],
    ], [27*mm,60*mm,70*mm])]
    story += [P("6.2 The 3 Cs", "H2")]
    story += [bullets([
        "Card: a short title and value statement - the reminder.",
        "Conversation: collaborative discovery among stakeholder, product owner, BA, developers and testers.",
        "Confirmation: examples and acceptance criteria that make the intended outcome verifiable.",
    ])]
    story += [P("6.3 INVEST quality check", "H2")]
    story += [table(["Letter", "Meaning", "Question to ask"], [
        ["I", "Independent", "Can this be delivered with minimal coupling, or is dependency explicit?"],
        ["N", "Negotiable", "Does it invite conversation instead of dictating every implementation detail?"],
        ["V", "Valuable", "Who receives value, and what changes for them?"],
        ["E", "Estimable", "Are intent, boundaries and key unknowns understood enough to size?"],
        ["S", "Small", "Can it be completed within one sprint without hiding unfinished work?"],
        ["T", "Testable", "Can the team demonstrate objective acceptance?"],
    ], [14*mm,35*mm,108*mm])]
    story += [P("Acceptance criteria vs Definition of Done", "H2")]
    story += [table(["Acceptance criteria", "Definition of Done"], [
        ["Specific to one story or feature; defines its expected behavior and boundaries.", "Shared quality standard applied to every increment, such as reviewed, tested, secure and deployable."],
        ["Example: weekend start rolls to Monday.", "Example: tests pass, accessibility checks completed, documentation updated."],
        ["Owned through product/stakeholder intent and refined collaboratively.", "A formal Scrum Team commitment in Scrum; consistent across Product Backlog Items in scope."],
    ], [78.5*mm,78.5*mm]), PageBreak()]

    story += section("7. Tailored user story catalogue - Admin")
    story += [story_block("US-A01", "Create a cohort from an approved plan",
        "As an Admin responsible for cohort setup, I want to create a batch from an approved training plan so that the full delivery structure is ready without manual duplication.",
        ["Batch name, plan and start date are required; facilitator is optional.", "Saturday or Sunday start rolls to the following Monday.", "Sessions, assignments, resources, announcements and configured feedback links are copied as independently editable records.", "If any mandatory copy step fails, no partial batch remains.", "A successful result opens or links to the created batch and records an audit event."],
        "This is an epic-sized story if the whole instantiation engine is new. Split by a thin vertical slice while preserving an end-to-end demonstrable outcome.")]
    story += [Spacer(1,5), story_block("US-A02", "Maintain the standard training plan",
        "As an Admin, I want to maintain approved plan content so that future cohorts use the current curriculum.",
        ["Admin can add, edit and remove template sessions, assignments, resources and default announcements.", "Changes affect only batches created after the change.", "The interface clearly warns that existing batches are not updated.", "Invalid dates, offsets, URLs and required fields are rejected with actionable messages."],
        "The copy boundary is a critical business rule, not just UI help text.")]
    story += [Spacer(1,5), story_block("US-A03", "Invite and enroll a trainee",
        "As an Admin, I want to invite a trainee into a batch so that the learner can activate an account and access the correct cohort.",
        ["Invitation is associated with the intended role and cohort.", "Invite token is single-use and time-bound according to the approved security policy.", "Acceptance creates or activates the account and enrollment without exposing the token in production responses.", "Duplicate or expired acceptance is handled safely and clearly."],
        "Confirm whether an existing user can be enrolled directly and whether re-invitation is allowed.")]
    story += [Spacer(1,5), story_block("US-A04", "Review operational audit evidence",
        "As an Admin, I want to review material portal activity so that I can investigate changes and demonstrate operational control.",
        ["Entries show actor, event type, module, time and affected object.", "Audit history is append-only to application users.", "Search, filters and pagination preserve accurate result counts.", "Sensitive values are masked or omitted according to policy."],
        "Create an agreed audit-event catalogue; 'log everything' is expensive and may increase privacy risk."), PageBreak()]

    story += section("7. Tailored user story catalogue - Facilitator")
    story += [story_block("US-F01", "Manage only assigned cohorts",
        "As a Facilitator, I want to manage my assigned batches so that I can deliver training without accessing unrelated cohorts.",
        ["The batch list contains only assigned batches.", "Direct API or URL access to an unassigned batch is denied server-side.", "Metrics and rosters use the same cohort scope.", "An Admin retains authorized oversight."],
        "Negative authorization tests are essential; hiding a navigation link is not access control.")]
    story += [Spacer(1,5), story_block("US-F02", "Record session attendance",
        "As a Facilitator, I want to record attendance for a session so that participation is visible and metrics remain current.",
        ["Only enrolled trainees are offered for the selected session's batch.", "Each trainee has at most one attendance record per session.", "Bulk save reports success or actionable validation errors.", "A permitted correction updates the record and creates the required audit evidence."],
        "Agree status values and whether future-session attendance can be recorded.")]
    story += [Spacer(1,5), story_block("US-F03", "Grade a submission",
        "As a Facilitator, I want to grade submissions for my batches so that trainees receive an accurate performance result.",
        ["Facilitator can open submissions only for owned batches.", "Grade accepts values from 0 through 100 inclusive.", "Invalid values do not alter the stored grade.", "The trainee can see the saved result according to the agreed release rule."],
        "Clarify whether draft grades and release dates are needed; the implemented rule currently stores the grade directly.")]
    story += [Spacer(1,5), story_block("US-F04", "Attach a feedback form",
        "As a Facilitator, I want to attach an external feedback form to a session or assignment so that eligible participants can provide structured feedback.",
        ["The URL is valid and the audience is Trainees, Facilitators or Both.", "Only eligible users see the submission action.", "One completion marker is retained per form and user; repeated marking is idempotent.", "Removing the form removes access to the link without corrupting unrelated performance feedback."],
        "Session feedback, assignment feedback and performance feedback are separate concepts and data models."), PageBreak()]

    story += section("7. Tailored user story catalogue - Trainee")
    story += [story_block("US-T01", "See my current learning plan",
        "As a Trainee, I want one view of my current batch, schedule and progress so that I know what to do next.",
        ["Only enrolled cohort data is displayed.", "Upcoming sessions and deadlines use consistent local date/time presentation.", "Missing metrics are shown honestly as unavailable, not as zero or fabricated data.", "The current batch is identified consistently when more than one enrollment exists."],
        "Define the current-batch selection rule with stakeholders; the implementation uses the first/earliest enrollment convention.")]
    story += [Spacer(1,5), story_block("US-T02", "Submit and resubmit work",
        "As a Trainee, I want to upload my assignment work so that it can be reviewed by my facilitator.",
        ["A trainee can submit only to an assignment in an enrolled batch.", "A first submission after the deadline is accepted and marked late.", "A resubmission after the deadline is blocked with an explanatory message.", "A permitted resubmission makes the new attachment current and preserves earlier attachment history.", "File type and size rules are validated before storage is treated as successful."],
        "The distinction between late first submission and late resubmission is unusual; keep it visible in requirements and training.")]
    story += [Spacer(1,5), story_block("US-T03", "Access verified learning resources",
        "As a Trainee, I want to access relevant learning resources so that I can prepare and complete assigned work.",
        ["Only resources visible to the trainee's cohort and allowed by verification rules are listed.", "File resources download securely; external resources open the validated URL.", "Download count changes only after an authorized download request.", "Unavailable content produces a clear, non-sensitive error."],
        "Clarify whether global resources and batch resources have different verification ownership.")]
    story += [Spacer(1,5), story_block("US-T04", "Complete feedback",
        "As a Trainee, I want to find pending session and assignment feedback so that I can complete it without searching through messages.",
        ["Only forms whose audience includes trainees are shown.", "Submitted and pending states are distinguishable.", "Opening or marking one form does not change another form's status.", "A user cannot mark feedback for a cohort in which the user is not enrolled."],
        "External form completion itself cannot be proven unless integrated; the portal currently records a completion marker."), PageBreak()]

    story += section("7. Example in Given / When / Then form")
    story += [P("Story: US-T02 - submit and resubmit work", "H2")]
    scenarios = [
        ["First submission before deadline", "Given an enrolled trainee and an open assignment<br/>When the trainee uploads a valid file before the deadline<br/>Then a submission is created and the file is current."],
        ["First submission after deadline", "Given no earlier submission and the deadline has passed<br/>When the trainee uploads a valid file<br/>Then the submission is accepted and identifiable as late."],
        ["Resubmission before deadline", "Given a current submission and the deadline has not passed<br/>When the trainee uploads a valid replacement<br/>Then the replacement becomes current and the earlier attachment remains in history."],
        ["Resubmission after deadline", "Given a current submission and the deadline has passed<br/>When the trainee attempts a replacement<br/>Then the request is rejected and the current attachment is unchanged."],
        ["Unauthorized batch", "Given the trainee is not enrolled in the assignment's batch<br/>When the trainee attempts a submission through the API<br/>Then access is denied and no submission or file is created."],
    ]
    story += [table(["Scenario", "Behavior"], scenarios, [48*mm,109*mm])]
    story += [P("Why examples matter", "H2"), P("The sentence-format story does not reveal the late-submission distinction, attachment history, authorization boundary or atomic failure behavior. Concrete examples expose these decisions early and can be reused for automated and UAT tests.")]
    story += [callout("Acceptance criteria are boundaries, not exhaustive tests", "QA will still explore file corruption, simultaneous requests, upload interruption, storage failure, malicious names, browser behavior and other risks. Criteria align intent; test design probes the implementation more broadly.", CYAN, BLUE), PageBreak()]

    story += section("8. Traceability - connecting value to evidence", "Traceability prevents orphan features and unsupported business promises. Keep it useful, not ceremonial.")
    trace = [
        ["BR-02 Standardize setup", "FR-02 Batch creation; FR-03 Scheduling", "US-A01", "Create cohort; weekend start; rollback", "Sponsor / UAT"],
        ["BR-03 Preserve independence", "FR-04 Isolation", "US-A02", "Edit live batch; verify template unchanged", "Training owner"],
        ["BR-04 Appropriate access", "FR-01 Auth; FR-05 Authorization; FR-08 Feedback", "US-F01, US-T04", "Role/cohort positive and negative access", "Security + UAT"],
        ["BR-05 Maintain evidence", "FR-06 History; FR-09 Read state; FR-10 Audit", "US-A04, US-F02", "Audit immutability; history; read-state isolation", "Governance"],
        ["BR-06 Learner clarity", "FR-06 Submission; FR-07 Deadline", "US-T01, US-T02", "Late first submit; blocked late resubmit", "Product + UAT"],
        ["BR-07 Scoped delivery", "FR-05 Authorization", "US-F01, US-F03", "Facilitator cannot access unowned cohort", "Training owner"],
    ]
    story += [table(["Business requirement", "Functional coverage", "Stories", "Evidence", "Acceptance"], trace, [37*mm,43*mm,29*mm,32*mm,25*mm])]
    story += [P("Minimum traceability fields", "H2")]
    story += [bullets([
        "Unique ID and concise name.", "Source and accountable owner.", "Rationale / business objective.", "Priority and release or status.",
        "Upstream and downstream links.", "Acceptance method and evidence location.", "Change history, decision and impact where baselined.",
    ])]
    story += [P("Coverage questions", "H2")]
    story += [table(["Direction", "Question", "Finding to investigate"], [
        ["Forward", "Does every approved business requirement have functional and delivery coverage?", "Promise with no planned capability"],
        ["Backward", "Does every feature/story trace to value, risk or obligation?", "Gold plating or obsolete work"],
        ["Verification", "Does every test prove an approved behavior or risk control?", "Wasteful or missing test coverage"],
        ["Change", "Which stories, rules, tests, reports and training materials are affected?", "Hidden change cost"],
    ], [25*mm,91*mm,41*mm]), PageBreak()]

    story += section("9. Recommended BA workflow for this application")
    story += [numbered([
        "Frame the need. Confirm sponsor, problem, desired outcomes, measurable indicators and decision deadline.",
        "Map stakeholders and scope. Identify each role, operational owner, external dependency and affected process.",
        "Elicit with evidence. Review current workflows, source code behavior, policies, data samples, defects and support issues; do not rely on interviews alone.",
        "Model before writing prose. Use a context diagram, process flow, state model, decision table, data model and permission matrix where each is useful.",
        "Write and validate business requirements. Separate need from favored solution; agree priority, ownership and success measures.",
        "Specify behavior. Write functional requirements, rules, data, errors, interfaces and NFRs with unique IDs and examples.",
        "Slice delivery. Create epics and user stories that produce observable value; add acceptance criteria and identify dependencies.",
        "Review from three lenses. Business asks 'does this solve the need?', delivery asks 'can we build it?', QA asks 'can we prove it?'. Security and operations review cross-cutting risks.",
        "Baseline only what needs control. Version approved scope and important rules while allowing backlog detail to evolve.",
        "Maintain traceability and decisions. Update links and impact analysis when a requirement changes; retire obsolete items visibly.",
        "Support acceptance and measure outcomes. Facilitate UAT, capture evidence, distinguish defects from new scope, and compare post-release measures with baseline.",
    ])]
    story += [P("Suggested artifact set", "H2")]
    story += [table(["Artifact", "Recommended form for Trainee Portal", "Owner / collaborators"], [
        ["Business frame", "Concise BRD: outcomes, scope, high-level requirements, risks, measures", "Sponsor + BA + training owner"],
        ["Functional reference", "Living FRD organized by module, including rules and permission matrix", "BA / product, engineering, QA"],
        ["Delivery backlog", "Epics and stories linked to FR IDs; criteria in examples/Gherkin as useful", "Product owner + team"],
        ["Models", "Role-permission matrix, batch instantiation flow, submission state model, data dictionary", "BA with SMEs and engineers"],
        ["Decision log", "Date, question, options, decision, owner, rationale and affected IDs", "BA / product owner"],
        ["Traceability", "Lightweight matrix or tool links from BR -> FR -> story -> test", "BA + QA"],
    ], [32*mm,82*mm,43*mm]), PageBreak()]

    story += section("10. Reviews, anti-patterns and elicitation prompts")
    story += [P("Anti-patterns", "H2")]
    story += [table(["Anti-pattern", "Why it hurts", "Correction"], [
        ["BRD lists screens and buttons", "Outcome and scope decisions become hidden inside design.", "Restore problem, value and capability language; link UI separately."],
        ["FRD repeats the BRD", "Delivery still lacks rules, states, validation and exceptions.", "Add precise behavior and models; preserve trace links."],
        ["One story for an entire module", "Cannot estimate, prioritize, demonstrate or learn incrementally.", "Slice by workflow step, rule, data variation or role while keeping vertical value."],
        ["Acceptance criteria describe implementation tasks", "They do not prove user/business behavior.", "State observable outcomes; keep tasks in the delivery plan."],
        ["Everything is Must", "No usable priority or scope trade-off exists.", "Use explicit decision criteria and a real owner for priority."],
        ["Happy path only", "Production failures emerge in permissions, invalid data and dependencies.", "Ask 'what if?', use decision tables and negative scenarios."],
        ["UI hides unauthorized actions", "Direct API access may still expose data or mutate state.", "Specify and test server-side authorization."],
        ["Zero means unknown", "Reports communicate false performance.", "Define null, not-applicable, zero and stale states separately."],
    ], [36*mm,58*mm,63*mm])]
    story += [P("Elicitation prompts for the portal", "H2")]
    story += [bullets([
        "Who approves a training plan, and what constitutes a new plan version?",
        "Should existing batches ever receive selected template updates? If yes, how are conflicts resolved?",
        "Which calendar holidays, time zones and non-working days must scheduling support beyond weekends?",
        "What makes a batch 'current' for a trainee enrolled in more than one cohort?",
        "Which late-submission policy is intentional, and who may grant exceptions?",
        "When is a grade visible, editable, locked or disputed?",
        "What proves external feedback was truly submitted rather than merely marked complete?",
        "Which actions require audit, how long is evidence retained, and who may export it?",
        "Which learner data is personal or sensitive, and what retention/deletion rules apply?",
        "What load, availability, accessibility, backup and recovery targets are acceptable for production?",
    ])]
    story += [P("Definition workshop", "H2"), callout("A useful 60-minute session", "10 min: objective and decisions needed. 15 min: walk the main flow. 15 min: exceptions and rules. 10 min: data and permissions. 5 min: non-functional risks. 5 min: decisions, owners and due dates. Send models and examples before the meeting; use the meeting to decide, not to read.", GREEN, TEAL), PageBreak()]

    story += section("Appendix A. Reusable mini-templates")
    story += [P("A.1 Lean BRD template", "H2")]
    story += [bullets([
        "Document control: status, owner, approvers, version and decision date.",
        "Executive summary: problem, opportunity, proposed change and expected value.",
        "Business context and evidence: current state, baseline and root causes.",
        "Objectives and measures: definition, baseline, target, owner and measurement window.",
        "Stakeholders and impacts: needs, decisions, influence and change impact.",
        "Scope: in scope, out of scope, interfaces and boundaries.",
        "Business requirements: unique IDs, statement, rationale, source, priority and owner.",
        "Assumptions, constraints, dependencies and risks.",
        "High-level future process and capability view.",
        "Acceptance of business outcomes, traceability and sign-off.",
    ])]
    story += [P("A.2 FRD requirement record", "H2")]
    story += [table(["Field", "Prompt"], [
        ["ID / title", "Stable unique ID and short searchable name"], ["Statement", "Actor/trigger + required behavior + outcome"],
        ["Rationale / source", "Why needed and who supplied or approved it"], ["Preconditions", "State that must already be true"],
        ["Inputs / validation", "Fields, formats, ranges, requiredness and cross-field rules"], ["Main behavior", "Observable processing and output"],
        ["Alternatives / errors", "Branches, failures, messages, rollback and retry"], ["Data / audit", "Create/read/update/delete, lineage, history and evidence"],
        ["Permissions", "Role, ownership, cohort and record-level conditions"], ["NFR links", "Security, performance, accessibility, availability, privacy"],
        ["Trace / priority", "Upstream BR, downstream stories/tests, release and status"], ["Acceptance", "Approver, method and evidence location"],
    ], [40*mm,117*mm])]
    story += [P("A.3 User story card", "H2")]
    story += [P("<b>Title:</b> [short outcome]<br/><b>Story:</b> As a [persona], I want [goal], so that [value].<br/><b>Context:</b> [workflow, data, rule, constraint]<br/><b>Acceptance criteria:</b> [3-7 testable examples, including important negative paths]<br/><b>Dependencies:</b> [IDs / teams / decisions]<br/><b>Out of scope:</b> [boundary]<br/><b>Trace:</b> [BR and FR IDs]<br/><b>Open questions:</b> [owner and due date]", "Quote")]
    story += [P("A.4 Decision log entry", "H2")]
    story += [P("<b>Date | Decision ID | Question | Options considered | Decision | Rationale | Decision owner | Affected requirement/story IDs | Follow-up owner/date</b>", "Quote"), PageBreak()]

    story += section("Appendix B. Source notes and references", "The guide synthesizes the sources below and application evidence. It does not reproduce copyrighted source text.")
    refs = [
        ("International Institute of Business Analysis (IIBA), BABOK glossary", "Defines business, stakeholder and solution requirement concepts and related BA terminology.", "https://www.iiba.org/career-resources/a-business-analysis-professionals-foundation-for-success/babok/glossary/"),
        ("IIBA, Understanding Requirements and Designs", "Explains the BABOK requirements classification schema and relationship between requirements and designs.", "https://www.iiba.org/knowledgehub/the-business-analysis-standard/4-implementing-business-analysis/4-4-understanding-requirements-and-designs/"),
        ("IIBA, Needs and Solutions, Requirements and Designs", "Provides conceptual grounding for need, value, requirement, design and solution.", "https://www.iiba.org/professional-development/knowledge-centre/articles/needs-and-solutions/"),
        ("ISO, ISO/IEC/IEEE 29148:2018", "Requirements engineering processes and requirements-related information items; edition confirmed in 2024 and marked for revision in 2026.", "https://www.iso.org/standard/72089.html"),
        ("Agile Alliance, User Stories glossary", "User-story practice, user goals, acceptance criteria and INVEST competency references.", "https://agilealliance.org/glossary/user-stories/"),
        ("Agile Alliance, Agile Playbook", "The Card, Conversation, Confirmation model and story/epic guidance.", "https://www.agilealliance.org/wp-content/uploads/2018/12/08.031.17-Agile-Playbook-2.1-v12-One-Per-Student.pdf"),
        ("Atlassian, User stories with examples and a template", "Practical explanation of user stories, value framing and acceptance criteria.", "https://www.atlassian.com/agile/project-management/user-stories"),
        ("Atlassian, Acceptance criteria", "Distinguishes story intent from explicit, verifiable conditions of success.", "https://www.atlassian.com/work-management/project-management/acceptance-criteria"),
        ("Schwaber and Sutherland, The Scrum Guide (2020)", "Defines Product Backlog, refinement and Definition of Done; Scrum does not require the user-story format.", "https://scrumguides.org/docs/scrumguide/v2020/2020-Scrum-Guide-US.pdf"),
    ]
    for i, (name, use, url) in enumerate(refs, 1):
        story += [P(f"{i}. {name}", "H3"), P(use, "Small"), P(f'<link href="{url}" color="#1677A6">{url}</link>', "Source")]
    story += [P("Application evidence reviewed", "H2")]
    story += [bullets([
        "Project context and confirmed business rules in CLAUDE_PROJECT_CONTEXT.md.",
        "Implemented role journeys and process flows in USER_FLOWS.md.",
        "Existing FRD build workflow and generated functional requirements artifacts.",
        "Frontend routes, services and role navigation; backend routes, validators, services, tests and Prisma data model.",
    ])]
    story += [callout("Terminology note", "Organizations may call the same artifact a Business Requirements Document, Business Requirements Specification, Functional Specification, Software Requirements Specification or Product Requirements Document. Agree purpose, audience, content and authority; the label alone does not guarantee quality.", PALE_AMBER, AMBER)]
    story += [Spacer(1,10), HRFlowable(width="100%", thickness=1, color=HexColor("#CBD7DD")), Spacer(1,6), P("End of guide - use the templates as a starting point and adapt the level of rigor to risk and decision needs.", "Source")]

    doc.multiBuild(story)
    print(OUT)


if __name__ == "__main__":
    build()
