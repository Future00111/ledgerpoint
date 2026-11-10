## Cookies on GOV.UK

We use some essential cookies to make this website work.

We’d like to set additional cookies to understand how you use GOV.UK, remember your settings and improve government services.

We also use cookies set by other sites to help us deliver content from their services.

You have accepted additional cookies. You can [change your cookie settings](https://www.gov.uk/help/cookies) at any time.

You have rejected additional cookies. You can [change your cookie settings](https://www.gov.uk/help/cookies) at any time.

Accept additional cookiesReject additional cookies [View cookies](https://www.gov.uk/help/cookies)

Hide cookie message


[Skip to main content](https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026#content)

- [HM Revenue\\
\\
& Customs](https://www.gov.uk/government/organisations/hm-revenue-customs)


Print this page

![](https://www.gov.uk/assets/frontend/open-government-licence-min-93b6a51b518ff99714a1aa2a7d2162735c155ec3cb073c75fb88b2a332fa83d3.png)

© Crown copyright 2025

This publication is licensed under the terms of the Open Government Licence v3.0 except where otherwise stated. To view this licence, visit [nationalarchives.gov.uk/doc/open-government-licence/version/3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3) or write to the Information Policy Team, The National Archives, Kew, London TW9 4DU, or email: [psi@nationalarchives.gov.uk](mailto:psi@nationalarchives.gov.uk).

Where we have identified any third party copyright information you will need to obtain permission from the copyright holders concerned.

This publication is available at https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026

The specification describes 2 parameters:

- annual constants whose values are supplied by HMRC
- weekly or monthly constants taken from them for the payroll run

There are currently 5 types of student loan, these are:

- Student Loan Plan Type 1 (SLP1), introduced from 6 April 2000
- Student Loan Plan Type 2 (SLP2), introduced from 6 April 2016
- Student Loan Plan Type 4 (SLP4), introduced from 6 April 2021
- Student Loan Plan Type 5 (SLP5), introduced from 6 April 2026
- Postgraduate Loan (PGL), introduced from 6 April 2019

The loan deductions all work in the same way, being calculated as a percentage of employee earnings that are subject to Class 1 National Insurance contributions (E) above an earnings threshold.

Once the earnings threshold has been reached, employers will only have to use one student loan (Plan Type 1, Plan Type 2, Plan Type 4 or Plan Type 5) through payroll, even though an employee may have all loan types.

A postgraduate loan can be used on its own, or at the same time as one of the student loan plan types.

## 1. Student loan instructions

There are 3 ways that an employer will be told to start loan deductions. This is not applicable for deemed employees subject to the off-payroll working rules, whose student loan repayments are not collected through the payroll of their clients.

### 1.1 Direct instruction by HMRC

HMRC will issue an SL1 start notice to tell an employer to start operating a student loan (Plan 1, Plan 2, Plan 4 or Plan 5). The SL1 will have the plan type that must be operated.

HMRC will issue a PGL1 start notice to tell an employer to start using a postgraduate loan.

HMRC will automatically issue SL1 and PGL1 start notices when a new employment is notified, even if deductions have already started.

### 1.2 Instruction from a P45 with the ‘continue student loan’ box completed

The employer should ask the new employee what types of loan are being repaid and set up one student loan (Plan Type 1, Plan Type 2, Plan Type 4 or Plan Type 5) or a postgraduate loan as appropriate. The starter checklist can support this.

If the new employee does not know the type of loan the employer must operate the student loan type with the lowest recovery threshold (this only applies where the employee has student loans). The employee can confirm their correct loan type by signing in to their [student loan account](https://www.gov.uk/government/organisations/student-loans-company).

### 1.3 Instruction from a starter checklist completed by a new employee

The employer should set up the loan deductions as indicated by the questions on the starter checklist. Where the employee is on more than one plan type the employee should check their correct plan type they are due to repay by signing in to their [student loan account](https://www.gov.uk/government/organisations/student-loans-company). If the employee still doesn’t know the employer can start deductions for the plan type with the lowest recovery threshold until you get an SL1.

## 2. Using the wrong plan type

When a new employee does not know the type of loan, the employer must use the student loan type with the lowest recovery threshold (this only applies where the employee has student loans).

If the wrong loan type is being used, HMRC will send the appropriate Start Notice to notify the correct loan type as follows:

- SL1 for a student loan
- PGL1 for a postgraduate loan

HMRC will tell an employer to stop making loan deductions by sending a:

- SL2 stop notice to end a student loan
- PGL2 to end a postgraduate loan

## 3. Calculate loan deductions

| Type of loan | Annual threshold (AT) | Recovery rate (R) | Tax regime |
| --- | --- | --- | --- |
| Student Loan Plan 1 | SL1T | SL1R | All UK |
| Student Loan Plan 2 | SL2T | SL2R | All UK |
| Student Loan Plan 4 | SL4T | SL4R | All UK |
| Student Loan Plan 5 | SL5T | SL5R | All UK |
| Postgraduate Loan | PGLT | PGLR | All UK |

Periodic thresholds (PT) are calculated by dividing the annual threshold (AT) by the number of periods in the year (NP), rounding the result down if necessary, to the penny: PT = AT ÷ NP.

The practical maximum field sizes recommended for the Annual Constants are:

- AT — 99999
- R — 99.99%

Loan deductions (LD) are calculated for each loan type where employee earnings that are subject to Class 1 National Insurance contributions (E) exceed the periodic threshold (PT) for each loan. The loan deduction for each loan type is calculated as the Recovery Rate (R) percentage of the earnings that are more than the threshold, rounding the result down to the pound if necessary:

Where E is more than PT then LD = (E – PT) × R.

From April 2019, where a priority attachment of earnings order with protected earnings is also in use, the loan deductions are restricted so that the remaining pay cannot be reduced below the protected earnings amount. Where both a student loan and a postgraduate loan are in use, loan deductions must be allocated first to the postgraduate loan as it has a higher rate of interest.

## 4. Parameter values

### 4.1 Annual threshold (AT)

| Tax year | SL1T | SL2T | SL4T | SL5T | PGL |
| --- | --- | --- | --- | --- | --- |
| 2019 to 2020 | £18,935 | £25,725 | not applicable | not applicable | £21,000 |
| 2020 to 2021 | £19,390 | £26,575 | not applicable | not applicable | £21,000 |
| 2021 to 2022 | £19,895 | £27,295 | £25,000 | not applicable | £21,000 |
| 2022 to 2023 | £20,195 | £27,295 | £25,375 | not applicable | £21,000 |
| 2023 to 2024 | £22015 | £27,295 | £27,660 | not applicable | £21,000 |
| 2024 to 2025 | £24,990 | £27,295 | £31,395 | not applicable | £21,000 |
| 2025 to 2026 | £26,065 | £28,470 | £32,745 | not applicable | £21,000 |
| 2026 to 2027 | £26,900 | £ 29,385 | £33,795 | £25,000 | £21,000 |

### 4.2 Recovery rate (R)

| Tax Year | SL1R | SL2R | SL4R | SL5R | PGLR |
| --- | --- | --- | --- | --- | --- |
| 2019 to 2020 | 9% | 9% | not applicable | not applicable | 6% |
| 2020 to 2021 | 9% | 9% | not applicable | not applicable | 6% |
| 2021 to 2022 | 9% | 9% | 9% | not applicable | 6% |
| 2022 to 2023 | 9% | 9% | 9% | not applicable | 6% |
| 2023 to 2024 | 9% | 9% | 9 % | not applicable | 6% |
| 2024 to 2025 | 9% | 9% | 9 % | not applicable | 6% |
| 2025 to 2026 | 9% | 9% | 9% | not applicable | 6% |
| 2026 to 2027 | 9% | 9% | 9% | 9% | 6% |

[Back to top](https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026#contents)

## Is this page useful?

- [Maybe](https://www.gov.uk/contact/govuk)
- Yes this page is useful
- No this page is not useful

Thank you for your feedback


Report a problem with this page

## Help us improve GOV.UK

Do not include personal or financial information like your National Insurance number or credit card details.

This field is for robots only. Please leave blank

What were you doing?

What went wrong?

SendCancel

## Help us improve GOV.UK

To help us improve GOV.UK, we’d like to know more about your visit today.
[Please fill in this survey (opens in a new tab)](https://www.smartsurvey.co.uk/s/gov-uk-banner/?c=/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026).


Cancel