/**
 * Prints every executed test case with its result (pass / fail / skip).
 *
 * Jest 30's built-in `--verbose` reporter stopped printing the per-test tree for
 * passing tests, so this reporter restores a simple checklist-style listing.
 * Registered alongside "default" in jest.config.js so the usual summary is kept.
 */
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const NC = "\x1b[0m";

const MARK = {
  passed: `${GREEN}✓${NC}`,
  failed: `${RED}✗${NC}`,
  skipped: `${YELLOW}○${NC}`,
  pending: `${YELLOW}○${NC}`,
  todo: `${YELLOW}○${NC}`,
  disabled: `${YELLOW}○${NC}`,
};

class ListReporter {
  constructor() {
    this.tally = { passed: 0, failed: 0, skipped: 0 };
  }

  onTestResult(_test, testResult) {
    const file = testResult.testFilePath.split("/tests/")[1] || testResult.testFilePath;
    console.log(`\n${DIM}${file}${NC}`);
    for (const t of testResult.testResults) {
      const mark = MARK[t.status] || `${YELLOW}?${NC}`;
      const dur = t.duration != null ? ` ${DIM}(${t.duration} ms)${NC}` : "";
      const name = [...t.ancestorTitles, t.title].join(" › ");
      console.log(`  ${mark} ${name}${dur}`);
      if (t.status === "passed") this.tally.passed++;
      else if (t.status === "failed") this.tally.failed++;
      else this.tally.skipped++;
    }
  }

  onRunComplete() {
    const { passed, failed, skipped } = this.tally;
    console.log(
      `\n${DIM}Test cases:${NC} ${GREEN}${passed} passed${NC}` +
        (failed ? `, ${RED}${failed} failed${NC}` : "") +
        (skipped ? `, ${YELLOW}${skipped} skipped${NC}` : "") +
        `, ${passed + failed + skipped} total`
    );
  }
}

module.exports = ListReporter;
