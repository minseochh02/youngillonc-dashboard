SELECT 
  전체사업소,
  b2c_팀,
  담당자,
  b2b팀
FROM employee_category
WHERE 담당자 LIKE '%사무실%' OR 담당자 LIKE '%남부지사%' OR b2c_팀 LIKE '%사무실%'
ORDER BY b2c_팀, 담당자;
