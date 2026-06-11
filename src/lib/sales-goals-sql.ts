/**
 * sales_goals is keyed by client_code. Roll up to employee/branch/team via clients.담당자.
 */
export const SQL_SALES_GOALS_FROM = `
  FROM sales_goals sg
  LEFT JOIN clients c_sg ON sg.client_code = c_sg.거래처코드
  LEFT JOIN employees e_sg ON c_sg.담당자코드 = e_sg.사원_담당_코드
  LEFT JOIN employee_category ec ON e_sg.사원_담당_명 = ec.담당자
`;
