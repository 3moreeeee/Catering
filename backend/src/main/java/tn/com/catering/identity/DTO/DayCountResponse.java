package tn.com.catering.identity.DTO;

import java.time.LocalDate;

/**
 * One day on the quote-activity series.
 *
 * <p>Days with no request are present with a count of zero: a gap in the series
 * would be read as missing data, when in fact nothing was submitted that day.
 */
public record DayCountResponse(LocalDate day, long quotes) {}
