import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Download,
  FileText,
  Home,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  mergeHousehold,
  readHousehold,
  readSettings,
  removeExpense,
  removeMember,
  replaceHousehold,
  saveExpense,
  saveMember,
  saveSettings,
} from './database'
import { createBackup, mergeBackup, parseBackup } from './backup'
import {
  filterExpensesByMonth,
  filterExpensesByRange,
  getBudgetSummary,
  getMonthlyTrend,
  getRecentMonths,
  isValidCalendarDate,
  summarizeMembers,
} from './finance'
import { formatCurrency, formatMonth, formatShortDate, parseCurrencyInput } from './format'
import { createExpensesCsv, createPdfReport, downloadFile } from './reports'
import { CATEGORIES, type Category, type Expense, type HouseholdSettings, type Member } from './types'

type Page = 'overview' | 'activity' | 'household' | 'reports'

const memberColors = ['#347b62', '#db714a', '#d3a83e', '#7389a7', '#9b6c83', '#65a6a1']
const chartColors = ['#347b62', '#db714a', '#d3a83e', '#7389a7', '#9b6c83', '#65a6a1', '#9caa72', '#b58b61']
const currentDate = new Date()
const currentMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`

function makeId(): string {
  return crypto.randomUUID()
}

function App() {
  const [page, setPage] = useState<Page>('overview')
  const [month, setMonth] = useState(currentMonth)
  const [members, setMembers] = useState<Member[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [settings, setSettings] = useState<HouseholdSettings>({ monthlyBudgetCents: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'expense' | 'member' | 'budget' | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All categories')
  const [expenseTypeFilter, setExpenseTypeFilter] = useState('All types')
  const [restoreMode, setRestoreMode] = useState<'overwrite' | 'merge'>('overwrite')
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    const [data, householdSettings] = await Promise.all([readHousehold(), readSettings()])
    setMembers(data.members)
    setExpenses(data.expenses)
    setSettings(householdSettings)
  }

  useEffect(() => {
    Promise.all([readHousehold(), readSettings()])
      .then(([data, householdSettings]) => {
        setMembers(data.members)
        setExpenses(data.expenses)
        setSettings(householdSettings)
      })
      .catch(() => setError('Local storage is unavailable. Check your browser storage settings.'))
      .finally(() => setLoading(false))
  }, [])

  const monthExpenses = useMemo(() => filterExpensesByMonth(expenses, month), [expenses, month])
  const summaries = useMemo(() => summarizeMembers(members, monthExpenses), [members, monthExpenses])
  const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0)
  const sharedTotal = monthExpenses.reduce(
    (sum, expense) => sum + (expense.type === 'shared' ? expense.amountCents : 0),
    0,
  )
  const monthlyIncome = members.reduce((sum, member) => sum + member.monthlyIncomeCents, 0)
  const budgetSummary = useMemo(() => getBudgetSummary(monthExpenses, settings.monthlyBudgetCents), [monthExpenses, settings.monthlyBudgetCents])
  const categoryData = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        name: category,
        value: monthExpenses
          .filter((expense) => expense.category === category)
          .reduce((sum, expense) => sum + expense.amountCents, 0),
      })).filter((item) => item.value > 0),
    [monthExpenses],
  )
  const trendData = useMemo(
    () => getMonthlyTrend(expenses, getRecentMonths(6, new Date(`${month}-15T12:00:00`))),
    [expenses, month],
  )

  const filteredExpenses = monthExpenses.filter((expense) => {
    const matchesQuery = expense.title.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = categoryFilter === 'All categories' || expense.category === categoryFilter
    const matchesType = expenseTypeFilter === 'All types' || expense.type === expenseTypeFilter.toLowerCase()
    return matchesQuery && matchesCategory && matchesType
  })

  const runAction = async (action: () => Promise<void>) => {
    try {
      setError('')
      await action()
      await refresh()
      return true
    } catch {
      setError('That change could not be saved. Your existing data is still safe.')
      return false
    }
  }

  const handleMemberSave = async (name: string, incomeCents: number) => {
    const member: Member = editingMember
      ? { ...editingMember, name, monthlyIncomeCents: incomeCents }
      : {
          id: makeId(),
          name,
          monthlyIncomeCents: incomeCents,
          color: memberColors[members.length % memberColors.length],
          createdAt: new Date().toISOString(),
        }
    if (!(await runAction(() => saveMember(member)))) return
    setModal(null)
    setEditingMember(null)
  }

  const handleExpenseSave = async (data: Omit<Expense, 'id' | 'createdAt'>) => {
    const expense: Expense = editingExpense
      ? { ...editingExpense, ...data }
      : { ...data, id: makeId(), createdAt: new Date().toISOString() }
    if (!(await runAction(() => saveExpense(expense)))) return
    setModal(null)
    setEditingExpense(null)
  }

  const handleBudgetSave = async (budgetCents: number | null) => {
    if (!(await runAction(() => saveSettings({ monthlyBudgetCents: budgetCents })))) return
    setModal(null)
  }

  const exportBackup = async () => {
    const backup = createBackup(members, expenses, settings)
    downloadFile(JSON.stringify(backup, null, 2), `home-ledger-backup-${currentMonth}.json`, 'application/json')
  }

  const restoreBackup = async (file: File) => {
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Backup file exceeds the 10 MB limit.')
      if (restoreMode === 'overwrite' && !window.confirm('Replace all existing members, expenses, and settings with this backup?')) return
      const imported = parseBackup(await file.text())
      if (restoreMode === 'overwrite') await replaceHousehold(imported)
      else await mergeHousehold(mergeBackup(createBackup(members, expenses, settings), imported))
      await refresh()
      setError('')
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : 'The backup could not be restored.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const changeMonth = (offset: number) => {
    const [year, number] = month.split('-').map(Number)
    const date = new Date(year, number - 1 + offset, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  const openMemberForm = (member: Member | null = null) => {
    setEditingMember(member)
    setModal('member')
  }

  const openExpenseForm = (expense: Expense | null = null) => {
    setEditingExpense(expense)
    setModal('expense')
  }

  const navItems: { id: Page; label: string; icon: typeof Home }[] = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'activity', label: 'Transactions', icon: ArrowDownLeft },
    { id: 'household', label: 'Household', icon: Users },
    { id: 'reports', label: 'Reports & backup', icon: FileText },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setPage('overview')} aria-label="Home Ledger home">
          <span className="brand-mark">h.</span>
          <span>Home Ledger</span>
        </a>
        <div className="workspace-label">YOUR HOUSEHOLD</div>
        <nav className="primary-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button className={`nav-item ${page === id ? 'active' : ''}`} key={id} onClick={() => setPage(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'activity' && <span className="nav-count">{monthExpenses.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-note">
            <ShieldCheck size={17} />
            <span>
              <strong>Private by design</strong>
              <small>Your data stays on this device.</small>
            </span>
          </div>
          <div className="profile-row">
            <div className="profile-avatar">{members[0]?.name.slice(0, 1).toUpperCase() ?? 'H'}</div>
            <div className="profile-label">
              <strong>{members.length ? `${members.length} household members` : 'Your household'}</strong>
              <small>Local workspace</small>
            </div>
            <Settings2 size={16} className="profile-settings" />
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Household</span>
            <span className="crumb-slash">/</span>
            <strong>{navItems.find((item) => item.id === page)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <button className="month-arrow" aria-label="Previous month" onClick={() => changeMonth(-1)}>
              <ArrowLeft size={14} />
            </button>
            <button className="month-control" onClick={() => document.getElementById('month-picker')?.focus()}>
              <CalendarDays size={16} />
              <span>{formatMonth(month)}</span>
              <ChevronDown size={14} />
              <input id="month-picker" aria-label="Select month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </button>
            <button className="month-arrow" aria-label="Next month" onClick={() => changeMonth(1)}>
              <ArrowRight size={14} />
            </button>
            <button className="button button-primary" onClick={() => openExpenseForm()}>
              <Plus size={16} /> Add expense
            </button>
          </div>
        </header>

        {error && (
          <div className="notice notice-error" role="alert">
            <CircleHelp size={17} />
            {error}
            <button aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={15} />
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Opening your local household ledger…</div>
        ) : (
          <div className="page-content" key={page}>
            {page === 'overview' && (
              <OverviewPage
                month={month}
                members={members}
                expenses={monthExpenses}
                summaries={summaries}
                totalSpent={totalSpent}
                sharedTotal={sharedTotal}
                monthlyIncome={monthlyIncome}
                budgetSummary={budgetSummary}
                categoryData={categoryData}
                trendData={trendData}
                onAddExpense={() => openExpenseForm()}
                onNavigate={setPage}
                onSetBudget={() => setModal('budget')}
              />
            )}
            {page === 'activity' && (
              <ActivityPage
                month={month}
                expenses={filteredExpenses}
                members={members}
                query={query}
                categoryFilter={categoryFilter}
                typeFilter={expenseTypeFilter}
                onQuery={setQuery}
                onCategory={setCategoryFilter}
                onType={setExpenseTypeFilter}
                onAdd={() => openExpenseForm()}
                onEdit={openExpenseForm}
                onDelete={(id) => {
                  const expense = expenses.find((item) => item.id === id)
                  if (expense && window.confirm(`Delete “${expense.title}” from your ledger?`)) {
                    void runAction(() => removeExpense(id))
                  }
                }}
              />
            )}
            {page === 'household' && (
              <HouseholdPage
                members={members}
                summaries={summaries}
                onAdd={() => openMemberForm()}
                onEdit={openMemberForm}
                onDelete={(member) => {
                  if (window.confirm(`Remove ${member.name} and their personal expenses?`)) {
                    void runAction(() => removeMember(member.id))
                  }
                }}
              />
            )}
            {page === 'reports' && (
              <ReportsPage
                month={month}
                expenses={expenses}
                members={members}
                restoreMode={restoreMode}
                fileInput={fileInput}
                onRestoreMode={setRestoreMode}
                onRestore={restoreBackup}
                onBackup={exportBackup}
              />
            )}
          </div>
        )}
        <footer className="app-footer">
          <span>Home Ledger</span>
          <span>Nothing leaves this browser.</span>
          <span>Local-first household finances</span>
        </footer>
      </main>

      {modal === 'member' && <MemberDialog member={editingMember} onClose={() => setModal(null)} onSave={handleMemberSave} />}
      {modal === 'expense' && (
        <ExpenseDialog
          members={members}
          expense={editingExpense}
          month={month}
          onClose={() => setModal(null)}
          onSave={handleExpenseSave}
          onAddMember={() => {
            setModal('member')
            setEditingMember(null)
          }}
        />
      )}
      {modal === 'budget' && <BudgetDialog settings={settings} onClose={() => setModal(null)} onSave={handleBudgetSave} />}
    </div>
  )
}

interface OverviewProps {
  month: string
  members: Member[]
  expenses: Expense[]
  summaries: ReturnType<typeof summarizeMembers>
  totalSpent: number
  sharedTotal: number
  monthlyIncome: number
  budgetSummary: ReturnType<typeof getBudgetSummary>
  categoryData: { name: string; value: number }[]
  trendData: { month: string; shared: number; personal: number }[]
  onAddExpense: () => void
  onNavigate: (page: Page) => void
  onSetBudget: () => void
}

function OverviewPage(props: OverviewProps) {
  const {
    month,
    members,
    expenses,
    summaries,
    totalSpent,
    sharedTotal,
    monthlyIncome,
    budgetSummary,
    categoryData,
    trendData,
    onAddExpense,
    onNavigate,
    onSetBudget,
  } = props
  const latestExpenses = expenses.slice(0, 5)

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A clearer view of home</p>
          <h1>
            Your money,
            <br />
            <em>in good company.</em>
          </h1>
        </div>
        <p className="heading-note">A thoughtful picture of your household finances, shared fairly and kept entirely yours.</p>
      </div>

      {!members.length ? (
        <section className="welcome-panel">
          <div className="welcome-copy">
            <span className="welcome-kicker">A fresh start, together</span>
            <h2>
              Set up your household
              <br />
              in a couple of minutes.
            </h2>
            <p>Add the people who share your home and their monthly take-home income. Home Ledger will work out a fair share for every common expense.</p>
            <button className="button button-light" onClick={() => onNavigate('household')}>
              <Users size={16} /> Set up household <ArrowRight size={15} />
            </button>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-house">
              <span />
              <i />
              <b />
            </div>
            <div className="art-ground" />
          </div>
        </section>
      ) : (
        <>
          <section className="metric-grid" aria-label="Monthly overview">
            <article className="metric-card metric-featured">
              <div className="metric-top">
                <span>Household spending</span>
                <span className="metric-icon">
                  <Wallet size={17} />
                </span>
              </div>
              <strong>{formatCurrency(totalSpent)}</strong>
              <small>
                {formatMonth(month)} <span className="dot-separator">·</span> all expenses
              </small>
              <div className="metric-foot">
                <span className="metric-foot-label">of {formatCurrency(monthlyIncome)} income</span>
                <div className="progress-track">
                  <span style={{ width: `${Math.min(monthlyIncome ? (totalSpent / monthlyIncome) * 100 : 0, 100)}%` }} />
                </div>
              </div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span>Shared expenses</span>
                <span className="metric-icon icon-green">
                  <Users size={17} />
                </span>
              </div>
              <strong>{formatCurrency(sharedTotal)}</strong>
              <small>Split by income weight</small>
              <div className="metric-aside">
                <ArrowDownLeft size={14} /> Across {members.length} {members.length === 1 ? 'member' : 'members'}
              </div>
            </article>
            <article className="metric-card">
              <div className="metric-top">
                <span>Personal expenses</span>
                <span className="metric-icon icon-peach">
                  <ArrowUpRight size={17} />
                </span>
              </div>
              <strong>{formatCurrency(totalSpent - sharedTotal)}</strong>
              <small>Kept individual, always</small>
              <div className="metric-aside">
                <ShieldCheck size={14} /> Private to each member
              </div>
            </article>
          </section>

          <section className="analytics-grid">
            <article className="surface trend-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">The bigger picture</p>
                  <h2>Spending over time</h2>
                </div>
                <span className="legend">
                  <i className="legend-shared" /> Shared <i className="legend-personal" /> Personal
                </span>
              </div>
              <div className="chart-area trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} barGap={5} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#e9e8e0" strokeDasharray="3 5" />
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short' })}
                      tick={{ fill: '#91968e', fontSize: 11 }}
                    />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value: number) => `$${Math.round(value / 100)}`} tick={{ fill: '#91968e', fontSize: 10 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} labelFormatter={(value) => formatMonth(String(value))} cursor={{ fill: '#f5f5f0' }} />
                    <Bar dataKey="shared" stackId="spend" fill="#347b62" radius={[0, 0, 0, 0]} maxBarSize={29} />
                    <Bar dataKey="personal" stackId="spend" fill="#dfaa54" radius={[4, 4, 0, 0]} maxBarSize={29} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="surface category-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Where it goes</p>
                  <h2>By category</h2>
                </div>
                <span className="small-period">THIS MONTH</span>
              </div>
              {categoryData.length ? (
                <div className="category-content">
                  <div className="donut-wrap">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} stroke="none">
                          {categoryData.map((item, index) => (
                            <Cell key={item.name} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-total">
                      <strong>{formatCurrency(totalSpent)}</strong>
                      <small>total</small>
                    </div>
                  </div>
                  <div className="category-legend">
                    {categoryData.slice(0, 5).map((item, index) => (
                      <div className="category-legend-row" key={item.name}>
                        <i style={{ background: chartColors[index % chartColors.length] }} />
                        <span>{item.name}</span>
                        <strong>{formatCurrency(item.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="No spending to chart yet" detail="Add your first expense and your categories will appear here." />
              )}
            </article>
          </section>

          <section className="surface budget-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Stay on track</p>
                <h2>Monthly budget</h2>
              </div>
              <button className="text-button" onClick={onSetBudget}>
                {budgetSummary.budgetCents === null ? 'Set budget' : 'Update budget'} <ArrowRight size={14} />
              </button>
            </div>
            {budgetSummary.budgetCents === null ? (
              <p className="budget-empty">No budget set for this household. Set a monthly budget to track progress against your target.</p>
            ) : (
              <div className="budget-content">
                <div className="budget-row">
                  <span>Spent</span>
                  <strong>{formatCurrency(budgetSummary.spentCents)}</strong>
                  <span>of {formatCurrency(budgetSummary.budgetCents)}</span>
                </div>
                <div className="budget-track">
                  <span
                    style={{
                      width: `${Math.min((budgetSummary.percentUsed ?? 0) * 100, 100)}%`,
                      background: (budgetSummary.remainingCents ?? 0) < 0 ? '#b6533d' : '#347b62',
                    }}
                  />
                </div>
                <div className="budget-footer">
                  <span>
                    {(budgetSummary.remainingCents ?? 0) >= 0
                      ? `${formatCurrency(budgetSummary.remainingCents ?? 0)} left`
                      : `${formatCurrency(Math.abs(budgetSummary.remainingCents ?? 0))} over budget`}
                  </span>
                  <span>{Math.round((budgetSummary.percentUsed ?? 0) * 100)}% used</span>
                </div>
              </div>
            )}
          </section>

          <section className="bottom-grid">
            <article className="surface activity-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">The latest</p>
                  <h2>Recent activity</h2>
                </div>
                <button className="text-button" onClick={() => onNavigate('activity')}>
                  View all <ArrowRight size={14} />
                </button>
              </div>
              {latestExpenses.length ? (
                <div className="compact-expense-list">
                  {latestExpenses.map((expense) => (
                    <ExpenseRow key={expense.id} expense={expense} members={members} />
                  ))}
                </div>
              ) : (
                <EmptyState title="The ledger is quiet" detail="Expenses you add will show up here." action={<button className="text-button" onClick={onAddExpense}>Add an expense <ArrowRight size={14} /></button>} />
              )}
            </article>
            <article className="surface people-panel">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">A fair share</p>
                  <h2>People & balance</h2>
                </div>
                <button className="icon-button" aria-label="Manage household members" onClick={() => onNavigate('household')}>
                  <ArrowRight size={17} />
                </button>
              </div>
              <div className="people-list">
                {summaries.map((summary) => (
                  <div className="person-row" key={summary.member.id}>
                    <div className="person-avatar" style={{ background: summary.member.color }}>
                      {summary.member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="person-info">
                      <strong>{summary.member.name}</strong>
                      <span>
                        {Math.round(summary.weight * 100)}% share <i /> {formatCurrency(summary.totalSpentCents)} spent
                      </span>
                    </div>
                    <div className={`person-balance ${summary.remainingCents < 0 ? 'negative' : ''}`}>
                      <strong>{formatCurrency(summary.remainingCents)}</strong>
                      <small>remaining</small>
                    </div>
                  </div>
                ))}
              </div>
              <div className="fairness-note">
                <span>
                  <Check size={13} />
                </span>{' '}
                Shared costs are proportional to income.
              </div>
            </article>
          </section>
        </>
      )}
    </>
  )
}

interface ActivityProps {
  month: string
  expenses: Expense[]
  members: Member[]
  query: string
  categoryFilter: string
  typeFilter: string
  onQuery: (query: string) => void
  onCategory: (category: string) => void
  onType: (type: string) => void
  onAdd: () => void
  onEdit: (expense: Expense) => void
  onDelete: (id: string) => void
}

function ActivityPage(props: ActivityProps) {
  const { month, expenses, members, query, categoryFilter, typeFilter, onQuery, onCategory, onType, onAdd, onEdit, onDelete } = props
  return (
    <>
      <PageTitle eyebrow="Your household ledger" title="Everyday spending." description="A complete, searchable record of the things your household spends on." />
      <section className="surface table-surface">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input aria-label="Search expenses" placeholder="Search expenses" value={query} onChange={(event) => onQuery(event.target.value)} />
          </div>
          <div className="filter-group">
            <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => onCategory(event.target.value)}>
              <option>All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <select aria-label="Filter by type" value={typeFilter} onChange={(event) => onType(event.target.value)}>
              <option>All types</option>
              <option>Shared</option>
              <option>Personal</option>
            </select>
            <button className="button button-primary" onClick={onAdd}>
              <Plus size={16} /> Add expense
            </button>
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Expense</th>
                <th>Date</th>
                <th>Category</th>
                <th>Type</th>
                <th>Member</th>
                <th className="align-right">Amount</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const member = members.find((item) => item.id === expense.memberId)
                return (
                  <tr key={expense.id}>
                    <td>
                      <strong className="expense-title">{expense.title}</strong>
                    </td>
                    <td>{formatShortDate(expense.date)}</td>
                    <td>
                      <span className="category-tag">{expense.category}</span>
                    </td>
                    <td>
                      <span className={`type-pill ${expense.type}`}>{expense.type === 'shared' ? 'Shared' : 'Personal'}</span>
                    </td>
                    <td>
                      {member ? (
                        <span className="table-member">
                          <i style={{ background: member.color }} />
                          {member.name}
                        </span>
                      ) : (
                        <span className="muted-cell">Household</span>
                      )}
                    </td>
                    <td className="align-right amount-cell">{formatCurrency(expense.amountCents)}</td>
                    <td>
                      <div className="row-actions">
                        <button aria-label={`Edit ${expense.title}`} onClick={() => onEdit(expense)}>
                          <Settings2 size={15} />
                        </button>
                        <button aria-label={`Delete ${expense.title}`} onClick={() => onDelete(expense.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!expenses.length && <EmptyState title="No expenses found" detail={`There are no matching expenses in ${formatMonth(month)}.`} action={<button className="text-button" onClick={onAdd}>Add an expense <ArrowRight size={14} /></button>} />}
        </div>
        <div className="table-footer">
          <span>
            {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
          </span>
          <span>Showing {formatMonth(month)}</span>
        </div>
      </section>
    </>
  )
}

interface HouseholdProps {
  members: Member[]
  summaries: ReturnType<typeof summarizeMembers>
  onAdd: () => void
  onEdit: (member: Member) => void
  onDelete: (member: Member) => void
}

function HouseholdPage({ members, summaries, onAdd, onEdit, onDelete }: HouseholdProps) {
  const totalIncome = members.reduce((sum, member) => sum + member.monthlyIncomeCents, 0)
  return (
    <>
      <PageTitle eyebrow="The people behind the plan" title="Your household." description="Income weights make shared costs fair. Personal purchases stay personal." action={<button className="button button-primary" onClick={onAdd}><Plus size={16} /> Add member</button>} />
      {!members.length ? (
        <section className="surface empty-members">
          <div className="empty-icon">
            <Users size={22} />
          </div>
          <h2>Start with your people.</h2>
          <p>Add a member and their monthly take-home income. You can add as many people as your household needs.</p>
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} /> Add first member
          </button>
        </section>
      ) : (
        <>
          <section className="household-summary">
            <div>
              <span>Combined monthly income</span>
              <strong>{formatCurrency(totalIncome)}</strong>
            </div>
            <div>
              <span>Household members</span>
              <strong>{members.length}</strong>
            </div>
            <div>
              <span>Shared split method</span>
              <strong>Proportional to income</strong>
            </div>
          </section>
          <section className="member-grid">
            {members.map((member) => {
              const summary = summaries.find((item) => item.member.id === member.id)
              const sharePercent = Math.round((summary?.weight ?? 0) * 100)
              return (
                <article className="member-card" key={member.id}>
                  <div className="member-card-head">
                    <div className="member-avatar-large" style={{ background: member.color }}>
                      {member.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="member-card-actions">
                      <button aria-label={`Edit ${member.name}`} onClick={() => onEdit(member)}>
                        <Settings2 size={16} />
                      </button>
                      <button aria-label={`Remove ${member.name}`} onClick={() => onDelete(member)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h2>{member.name}</h2>
                  <p className="member-income-label">Monthly take-home income</p>
                  <strong className="member-income">{formatCurrency(member.monthlyIncomeCents)}</strong>
                  <div className="member-share">
                    <div>
                      <span>Common expense share</span>
                      <strong>{sharePercent}%</strong>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${sharePercent}%`, background: member.color }} />
                    </div>
                  </div>
                  <div className="member-card-footer">
                    <span>Spent this month</span>
                    <strong>{formatCurrency(summary?.totalSpentCents ?? 0)}</strong>
                  </div>
                </article>
              )
            })}
            <button className="add-member-card" onClick={onAdd}>
              <span>
                <Plus size={18} />
              </span>
              <strong>Add another member</strong>
              <small>Extend your household ledger</small>
            </button>
          </section>
          <aside className="info-callout">
            <span>
              <CircleHelp size={17} />
            </span>
            <p>
              <strong>How income weights work</strong> Every shared expense is split according to each person's percentage of combined household income. If incomes change, future calculations use the new weights.
            </p>
          </aside>
        </>
      )}
    </>
  )
}

interface ReportsProps {
  month: string
  expenses: Expense[]
  members: Member[]
  restoreMode: 'overwrite' | 'merge'
  fileInput: React.RefObject<HTMLInputElement | null>
  onRestoreMode: (mode: 'overwrite' | 'merge') => void
  onRestore: (file: File) => void
  onBackup: () => Promise<void>
}

function ReportsPage(props: ReportsProps) {
  const { month, expenses, members, restoreMode, fileInput, onRestoreMode, onRestore, onBackup } = props
  const [startDate, setStartDate] = useState(`${month}-01`)
  const [endDate, setEndDate] = useState(() => {
    const [year, number] = month.split('-').map(Number)
    return `${month}-${String(new Date(year, number, 0).getDate()).padStart(2, '0')}`
  })
  const [category, setCategory] = useState<Category | 'All categories'>('All categories')

  useEffect(() => {
    const [year, number] = month.split('-').map(Number)
    setStartDate(`${month}-01`)
    setEndDate(`${month}-${String(new Date(year, number, 0).getDate()).padStart(2, '0')}`)
  }, [month])

  const reportExpenses = filterExpensesByRange(expenses, startDate, endDate, category)
  const reportSummaries = summarizeMembers(members, reportExpenses)
  const periodLabel =
    startDate === `${month}-01` && endDate.startsWith(`${month}-`)
      ? formatMonth(month)
      : `${startDate || 'Any date'} to ${endDate || 'Any date'}`
  const exportCsv = () => downloadFile(createExpensesCsv(reportExpenses, members), `home-ledger-expenses-${startDate || 'all'}-to-${endDate || 'all'}.csv`, 'text/csv;charset=utf-8')
  const exportPdf = async () => downloadFile(await createPdfReport(periodLabel, reportExpenses, reportSummaries), `home-ledger-report-${startDate || 'all'}-to-${endDate || 'all'}.pdf`, 'application/pdf')
  return (
    <>
      <PageTitle eyebrow="Your numbers, your call" title="Reports & backup." description="Take a clear picture of your household finances with you, or keep a safe copy close at hand." />
      <section className="report-section">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">Filtered export</p>
            <h2>Reports</h2>
          </div>
          <span>{reportExpenses.length} transactions</span>
        </div>
        <div className="report-filters">
          <label>
            From
            <input aria-label="Report start date" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            To
            <input aria-label="Report end date" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            Category
            <select aria-label="Report category" value={category} onChange={(event) => setCategory(event.target.value as Category | 'All categories')}>
              <option>All categories</option>
              {CATEGORIES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="report-cards">
          <article className="report-card report-csv">
            <div className="report-icon">
              <FileText size={19} />
            </div>
            <div className="report-card-copy">
              <h3>Spreadsheet report</h3>
              <p>Download transaction details as a CSV file, ready for your spreadsheet.</p>
            </div>
            <button className="button button-outline" onClick={exportCsv}>
              <Download size={15} /> Download CSV
            </button>
          </article>
          <article className="report-card report-pdf">
            <div className="report-icon">
              <FileText size={19} />
            </div>
            <div className="report-card-copy">
              <h3>Printable summary</h3>
              <p>A polished PDF with member contributions and an itemized expense list.</p>
            </div>
            <button className="button button-outline" onClick={() => void exportPdf()}>
              <Download size={15} /> Download PDF
            </button>
          </article>
        </div>
      </section>
      <section className="report-section">
        <div className="report-section-heading">
          <div>
            <p className="eyebrow">No account, no cloud</p>
            <h2>Your local data</h2>
          </div>
          <span>
            <ShieldCheck size={14} /> Stored on this device
          </span>
        </div>
        <article className="backup-panel">
          <div className="backup-intro">
            <span className="backup-icon">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h3>Keep your own backup</h3>
              <p>Export your members, expenses, and settings as a private JSON file. The file stays with you, not on a server.</p>
              <small>
                {members.length} members <i /> {expenses.length} recorded expenses
              </small>
            </div>
          </div>
          <div className="backup-actions">
            <button className="button button-outline" onClick={() => fileInput.current?.click()}>
              <Upload size={15} /> Restore backup
            </button>
            <button className="button button-primary" onClick={() => void onBackup()}>
              <ArrowDownToLine size={15} /> Export backup
            </button>
            <input ref={fileInput} className="sr-only" type="file" accept="application/json,.json" aria-label="Choose backup file" onChange={(event) => { const file = event.target.files?.[0]; if (file) onRestore(file) }} />
          </div>
          <div className="restore-mode">
            <label htmlFor="restore-mode">When restoring,</label>
            <select id="restore-mode" value={restoreMode} onChange={(event) => onRestoreMode(event.target.value as 'overwrite' | 'merge')}>
              <option value="overwrite">replace existing data</option>
              <option value="merge">merge with existing data</option>
            </select>
          </div>
        </article>
        <p className="backup-caution">
          <CircleHelp size={14} /> Restoring replaces or merges data atomically. A malformed backup never changes your current ledger.
        </p>
      </section>
    </>
  )
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-title-row">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  )
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-dot" />
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  )
}

function ExpenseRow({ expense, members }: { expense: Expense; members: Member[] }) {
  const member = members.find((item) => item.id === expense.memberId)
  return (
    <div className="compact-expense-row">
      <div className={`expense-category-icon category-${expense.category.toLowerCase()}`}>{expense.category === 'Groceries' ? 'G' : expense.category === 'Utilities' ? 'U' : expense.category.slice(0, 1)}</div>
      <div className="compact-expense-info">
        <strong>{expense.title}</strong>
        <span>
          {expense.category} <i /> {member?.name ?? 'Household'} <i /> {formatShortDate(expense.date)}
        </span>
      </div>
      <div className="compact-expense-amount">
        <strong>{formatCurrency(expense.amountCents)}</strong>
        <span className={`mini-type ${expense.type}`}>{expense.type}</span>
      </div>
    </div>
  )
}

function MemberDialog({ member, onClose, onSave }: { member: Member | null; onClose: () => void; onSave: (name: string, incomeCents: number) => Promise<void> }) {
  const [name, setName] = useState(member?.name ?? '')
  const [income, setIncome] = useState(member ? (member.monthlyIncomeCents / 100).toFixed(2) : '')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const cents = parseCurrencyInput(income)
    if (!name.trim()) return setFormError('Enter a name for this member.')
    if (cents === null) return setFormError('Enter a positive income with up to two decimal places.')
    setSaving(true)
    await onSave(name.trim(), cents)
    setSaving(false)
  }

  return (
    <Dialog onClose={onClose} title={member ? 'Update member' : 'Add a household member'}>
      <form onSubmit={submit} className="dialog-form">
        <p className="dialog-description">Monthly take-home income sets this member's proportional share of common expenses.</p>
        <label>
          Member name
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={60} placeholder="e.g. Alex" />
        </label>
        <label>
          Monthly take-home income
          <div className="money-input">
            <span>$</span>
            <input inputMode="decimal" value={income} onChange={(event) => setIncome(event.target.value)} placeholder="0.00" />
          </div>
        </label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : member ? 'Save changes' : 'Add member'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ExpenseDialog({
  members,
  expense,
  month,
  onClose,
  onSave,
  onAddMember,
}: {
  members: Member[]
  expense: Expense | null
  month: string
  onClose: () => void
  onSave: (data: Omit<Expense, 'id' | 'createdAt'>) => Promise<void>
  onAddMember: () => void
}) {
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amount, setAmount] = useState(expense ? (expense.amountCents / 100).toFixed(2) : '')
  const [category, setCategory] = useState<Category>(expense?.category ?? 'Groceries')
  const [type, setType] = useState<'shared' | 'personal'>(expense?.type ?? 'shared')
  const [memberId, setMemberId] = useState(expense?.memberId ?? members[0]?.id ?? '')
  const [date, setDate] = useState(expense?.date ?? `${month}-${String(new Date().getDate()).padStart(2, '0')}`)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const amountCents = parseCurrencyInput(amount)
    if (!title.trim()) return setFormError('Add a short description for this expense.')
    if (amountCents === null) return setFormError('Enter a positive amount with up to two decimal places.')
    if (type === 'personal' && !members.some((member) => member.id === memberId)) return setFormError('Choose a household member for this personal expense.')
    if (!isValidCalendarDate(date)) return setFormError('Choose a valid date.')
    setSaving(true)
    await onSave({ title: title.trim(), amountCents, category, type, memberId: type === 'personal' ? memberId : null, date })
    setSaving(false)
  }

  return (
    <Dialog onClose={onClose} title={expense ? 'Edit expense' : 'Add an expense'}>
      <form onSubmit={submit} className="dialog-form expense-form">
        <p className="dialog-description">Choose how this purchase belongs to your household.</p>
        <div className="segmented-control" role="group" aria-label="Expense type">
          <button type="button" className={type === 'shared' ? 'selected' : ''} onClick={() => setType('shared')}>
            <Users size={15} /> Shared
          </button>
          <button type="button" className={type === 'personal' ? 'selected' : ''} onClick={() => setType('personal')}>
            <Wallet size={15} /> Personal
          </button>
        </div>
        <label>
          Description
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="e.g. Weekly groceries" />
        </label>
        <div className="form-grid">
          <label>
            Amount
            <div className="money-input">
              <span>$</span>
              <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </div>
          </label>
          <label>
            Date
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
        </div>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {type === 'personal' &&
          (members.length ? (
            <label>
              Belongs to
              <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <button type="button" className="text-button add-member-prompt" onClick={onAddMember}>
              Add a household member first <ArrowRight size={14} />
            </button>
          ))}
        {type === 'shared' && (
          <p className="inline-note">
            <ShieldCheck size={15} /> This amount is split automatically using current income weights.
          </p>
        )}
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function BudgetDialog({ settings, onClose, onSave }: { settings: HouseholdSettings; onClose: () => void; onSave: (budgetCents: number | null) => Promise<void> }) {
  const [budget, setBudget] = useState(settings.monthlyBudgetCents === null ? '' : (settings.monthlyBudgetCents / 100).toFixed(2))
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (budget.trim() === '') {
      setSaving(true)
      await onSave(null)
      setSaving(false)
      return
    }
    const cents = parseCurrencyInput(budget)
    if (cents === null) return setFormError('Enter a positive budget with up to two decimal places or leave empty to clear.')
    setSaving(true)
    await onSave(cents)
    setSaving(false)
  }

  return (
    <Dialog onClose={onClose} title="Monthly budget">
      <form onSubmit={submit} className="dialog-form">
        <p className="dialog-description">Set a household budget for the selected month to track spending at a glance.</p>
        <label>
          Monthly budget
          <div className="money-input">
            <span>$</span>
            <input inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="0.00" />
          </div>
        </label>
        {formError && <p className="form-error" role="alert">{formError}</p>}
        <div className="dialog-actions">
          <button type="button" className="button button-subtle" onClick={onClose}>
            Cancel
          </button>
          <button className="button button-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save budget'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    dialog.addEventListener('keydown', closeOnEscape)
    return () => {
      dialog.removeEventListener('keydown', closeOnEscape)
      if (dialog.open) dialog.close()
    }
  }, [onClose])

  return (
    <dialog ref={dialogRef} className="app-dialog" aria-labelledby="home-ledger-dialog-title" onClick={(event) => { if (event.target === dialogRef.current) onClose() }}>
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Home Ledger</p>
          <h2 id="home-ledger-dialog-title">{title}</h2>
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export default App
